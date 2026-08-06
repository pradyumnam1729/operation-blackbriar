# 08 — REST API Integration Standards

## Overview

Every EAM adapter in the Aurigo Maintain integration layer implements the same `IEamAdapter` interface and follows the same resilience, pagination, rate limiting, and audit patterns. This document defines those standards. Adapter authors must follow them without exception — the consistent behavior is what makes the sync engine reliable across all EAM systems.

## The IEamAdapter Interface (Full Definition)

```csharp
/// <summary>
/// Contract that every EAM integration adapter must implement.
/// Maintain's sync engine operates exclusively on this interface.
/// Never add EAM-specific methods here — they belong in the concrete adapter.
/// </summary>
public interface IEamAdapter
{
    /// <summary>Unique identifier for this adapter type (e.g., "ibm-maximo", "cityworks").</summary>
    string AdapterName { get; }
    
    /// <summary>Display name shown in the admin UI.</summary>
    string DisplayName { get; }
    
    /// <summary>Check that the EAM system is reachable and credentials are valid.</summary>
    Task<AdapterHealthResult> CheckHealthAsync(CancellationToken ct = default);
    
    /// <summary>Retrieve assets, optionally filtered by change date (delta sync).</summary>
    Task<PagedResult<CanonicalAsset>> GetAssetsAsync(SyncRequest request, CancellationToken ct = default);
    
    /// <summary>Retrieve work orders, optionally filtered by change date.</summary>
    Task<PagedResult<CanonicalWorkOrder>> GetWorkOrdersAsync(SyncRequest request, CancellationToken ct = default);
    
    /// <summary>Retrieve PM schedules.</summary>
    Task<PagedResult<CanonicalPmSchedule>> GetPmSchedulesAsync(SyncRequest request, CancellationToken ct = default);
    
    /// <summary>Retrieve defect records (notifications, work requests, failure reports).</summary>
    Task<PagedResult<CanonicalDefect>> GetDefectsAsync(SyncRequest request, CancellationToken ct = default);
    
    // ── Hybrid and Native Mode only ──────────────────────────────────────────
    
    /// <summary>
    /// Write a work order recommendation back to the EAM system.
    /// Must be idempotent: calling twice with the same CapitalNeedId must not create a duplicate.
    /// </summary>
    Task<CreateResult> CreateWorkOrderAsync(CanonicalWorkOrder workOrder, CancellationToken ct = default);
    
    /// <summary>Update the status of a work order in the EAM system.</summary>
    Task<UpdateResult> UpdateWorkOrderStatusAsync(
        string eamNativeId, WorkOrderStatus status, CancellationToken ct = default);
}

// Supporting types
public record SyncRequest(
    string TenantId,
    DateTimeOffset? ChangedSince,
    int PageSize = 200,
    string? ContinuationToken = null
);

public record PagedResult<T>(
    IReadOnlyList<T> Items,
    string? NextContinuationToken,
    int TotalCount,
    bool HasMore
);

public record AdapterHealthResult(
    bool IsHealthy,
    string? Message,
    DateTimeOffset CheckedAt
);

public record CreateResult(string EamNativeId, DateTimeOffset CreatedAt);
public record UpdateResult(bool Success, string? Message);
```

## Resilience Patterns

Every adapter wraps its HTTP calls with a standardized Polly pipeline. The pipeline is registered in `Infrastructure/DependencyInjection.cs` and injected into each adapter. Adapters must not implement their own retry logic.

### Retry with Exponential Backoff

```csharp
// In Infrastructure/DependencyInjection.cs
services.AddHttpClient<IMaximoHttpClient, MaximoHttpClient>()
    .AddPolicyHandler(GetRetryPolicy())
    .AddPolicyHandler(GetCircuitBreakerPolicy())
    .AddPolicyHandler(GetTimeoutPolicy());

private static IAsyncPolicy<HttpResponseMessage> GetRetryPolicy()
{
    return HttpPolicyExtensions
        .HandleTransientHttpError()
        .OrResult(msg => msg.StatusCode == HttpStatusCode.TooManyRequests)
        .WaitAndRetryAsync(
            retryCount: 4,
            sleepDurationProvider: (retryAttempt, response, context) =>
            {
                // Respect Retry-After header if present (for 429)
                if (response?.Result?.Headers?.RetryAfter != null)
                {
                    var retryAfter = response.Result.Headers.RetryAfter;
                    return retryAfter.Delta ?? TimeSpan.FromSeconds(30);
                }
                // Exponential backoff with jitter: 5s, 30s, 2min, 10min
                return TimeSpan.FromSeconds(Math.Pow(4, retryAttempt))
                    + TimeSpan.FromMilliseconds(new Random().Next(0, 2000));
            },
            onRetryAsync: async (outcome, timespan, retryAttempt, context) =>
            {
                var logger = context.GetLogger();
                logger.LogWarning(
                    "EAM adapter retry {RetryAttempt} after {Delay}s. Status: {Status}",
                    retryAttempt, timespan.TotalSeconds, outcome.Result?.StatusCode);
                await Task.CompletedTask;
            });
}
```

### Circuit Breaker

The circuit breaker prevents cascading failures when the EAM system is down. If 50% of requests fail within a 60-second window, the circuit opens and all requests fail fast for 5 minutes.

```csharp
private static IAsyncPolicy<HttpResponseMessage> GetCircuitBreakerPolicy()
{
    return HttpPolicyExtensions
        .HandleTransientHttpError()
        .AdvancedCircuitBreakerAsync(
            failureThreshold: 0.50,           // 50% failure rate
            samplingDuration: TimeSpan.FromSeconds(60),
            minimumThroughput: 10,            // minimum 10 requests to evaluate
            durationOfBreak: TimeSpan.FromMinutes(5),
            onBreak: (outcome, breakDelay) =>
            {
                Log.Error("Circuit breaker opened for {Delay}min. Last status: {Status}",
                    breakDelay.TotalMinutes, outcome.Result?.StatusCode);
                // Publish metric to CloudWatch
            },
            onReset: () => Log.Information("Circuit breaker reset — EAM system healthy"));
}
```

### Timeout

```csharp
private static IAsyncPolicy<HttpResponseMessage> GetTimeoutPolicy()
{
    // Per-request timeout: 30 seconds
    return Policy.TimeoutAsync<HttpResponseMessage>(30);
}
```

### Bulkhead Isolation

Each adapter gets its own bulkhead to prevent one misbehaving EAM from blocking threads used by other adapters.

```csharp
private static IAsyncPolicy<HttpResponseMessage> GetBulkheadPolicy(int maxParallel = 10)
{
    return Policy.BulkheadAsync<HttpResponseMessage>(
        maxParallelization: maxParallel,
        maxQueuingActions: 50);
}
```

## Rate Limiting

Each adapter configuration includes rate limiting parameters:

```json
{
  "rateLimiting": {
    "maxRequestsPerMinute": 300,
    "maxConcurrentRequests": 10
  }
}
```

The `TokenBucketRateLimiter` (System.Threading.RateLimiting) is used to enforce these limits before requests leave the adapter:

```csharp
private readonly RateLimiter _rateLimiter;

public BaseEamAdapter(IntegrationAdapterConfig config)
{
    _rateLimiter = new TokenBucketRateLimiter(new TokenBucketRateLimiterOptions
    {
        TokenLimit = config.RateLimiting.MaxRequestsPerMinute,
        ReplenishmentPeriod = TimeSpan.FromMinutes(1),
        TokensPerPeriod = config.RateLimiting.MaxRequestsPerMinute,
        QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
        QueueLimit = 500
    });
}

protected async Task<HttpResponseMessage> SendWithRateLimitAsync(
    HttpRequestMessage request, CancellationToken ct)
{
    using var lease = await _rateLimiter.AcquireAsync(1, ct);
    if (!lease.IsAcquired) throw new RateLimitExceededException();
    return await _httpClient.SendAsync(request, ct);
}
```

## Pagination

### Page-Based Pagination (Most REST APIs)

```csharp
public async Task<PagedResult<CanonicalAsset>> GetAssetsAsync(SyncRequest request, CancellationToken ct)
{
    var allItems = new List<CanonicalAsset>();
    var pageNumber = 1;
    bool hasMore;

    do
    {
        var response = await FetchPageAsync(request, pageNumber, ct);
        var mapped = response.Items.Select(_mapper.Map).ToList();
        allItems.AddRange(mapped);
        hasMore = response.HasNextPage;
        pageNumber++;
        
        // Save progress after each page (resumable sync)
        await _syncStateRepo.UpdatePageAsync(request.TenantId, AdapterName, pageNumber);
        
    } while (hasMore && !ct.IsCancellationRequested);

    return new PagedResult<CanonicalAsset>(allItems, null, allItems.Count, false);
}
```

### Cursor-Based Pagination (Maximo OSLC)

```csharp
// Maximo OSLC returns an oslc:nextPage link in the response
private async Task<OslcPage> FetchOslcPageAsync(string url, CancellationToken ct)
{
    var response = await _httpClient.GetFromJsonAsync<OslcResponse>(url, ct);
    return new OslcPage(
        Items: response.Members,
        NextPageUrl: response.NextPage?.Href  // null if last page
    );
}

public async Task<PagedResult<CanonicalAsset>> GetAssetsAsync(SyncRequest request, CancellationToken ct)
{
    var url = BuildOslcUrl(request);  // includes oslc.where=CHANGEDATE>"..."
    string? nextUrl = url;
    var allItems = new List<CanonicalAsset>();

    while (nextUrl != null && !ct.IsCancellationRequested)
    {
        var page = await FetchOslcPageAsync(nextUrl, ct);
        allItems.AddRange(page.Items.Select(_mapper.Map));
        nextUrl = page.NextPageUrl;
        await _syncStateRepo.UpdateCursorAsync(request.TenantId, AdapterName, nextUrl ?? "DONE");
    }

    return new PagedResult<CanonicalAsset>(allItems, null, allItems.Count, false);
}
```

## Audit Trail

Every sync operation is logged to the `SyncOperationLog` table. This provides a complete history of what was synced, when, and whether it succeeded.

```csharp
public record SyncOperationLog
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public string TenantId { get; init; } = default!;
    public string AdapterName { get; init; } = default!;
    public string RecordType { get; init; } = default!;  // "asset", "workorder", "pm"
    public SyncMode Mode { get; init; }                  // InitialLoad, Delta, EventDriven
    public DateTimeOffset StartedAt { get; init; }
    public DateTimeOffset? CompletedAt { get; set; }
    public int RecordsFetched { get; set; }
    public int RecordsMapped { get; set; }
    public int RecordsUpserted { get; set; }
    public int RecordsFailed { get; set; }
    public SyncStatus Status { get; set; }               // Running, Completed, Failed, Degraded
    public string? ErrorSummary { get; set; }
    public string? LastContinuationToken { get; set; }
}
```

The sync job writes a `SyncOperationLog` record at the start of each sync run and updates it at completion. If a run fails mid-way, the `LastContinuationToken` is preserved so the next run can resume from the last successful page.

## OAuth 2.0 Token Refresh Strategy

```csharp
public class OAuthTokenCache
{
    private string? _token;
    private DateTimeOffset _expiresAt = DateTimeOffset.MinValue;
    private readonly SemaphoreSlim _lock = new(1, 1);
    
    public async Task<string> GetTokenAsync(Func<Task<TokenResponse>> tokenFactory)
    {
        // Fast path: token is still valid
        if (_token != null && DateTimeOffset.UtcNow < _expiresAt - TimeSpan.FromSeconds(60))
            return _token;
        
        await _lock.WaitAsync();
        try
        {
            // Double-check after acquiring lock
            if (_token != null && DateTimeOffset.UtcNow < _expiresAt - TimeSpan.FromSeconds(60))
                return _token;
            
            var response = await tokenFactory();
            _token = response.AccessToken;
            _expiresAt = DateTimeOffset.UtcNow.AddSeconds(response.ExpiresIn);
            return _token;
        }
        finally
        {
            _lock.Release();
        }
    }
    
    public void Invalidate() => _token = null;
}
```

On a 401 response, the adapter calls `_tokenCache.Invalidate()` and retries once. If the second attempt also returns 401, it is a credentials problem — halt the sync and alert.

## Complete Worked Example: Cityworks Adapter

```csharp
public class CityworksAdapter : IEamAdapter
{
    public string AdapterName => "cityworks";
    public string DisplayName => "Cityworks AMS";
    
    private readonly CityworksHttpClient _http;
    private readonly EsriGeometryClient _gis;
    private readonly CityworksAssetMapper _mapper;
    private readonly IntegrationAdapterConfig _config;
    
    public CityworksAdapter(
        CityworksHttpClient http,
        EsriGeometryClient gis,
        CityworksAssetMapper mapper,
        IntegrationAdapterConfig config)
    {
        _http = http;
        _gis = gis;
        _mapper = mapper;
        _config = config;
    }
    
    public async Task<AdapterHealthResult> CheckHealthAsync(CancellationToken ct)
    {
        try
        {
            var response = await _http.GetAsync("/Services/general/version", ct);
            return new AdapterHealthResult(response.IsSuccessStatusCode, 
                response.IsSuccessStatusCode ? "OK" : response.StatusCode.ToString(),
                DateTimeOffset.UtcNow);
        }
        catch (Exception ex)
        {
            return new AdapterHealthResult(false, ex.Message, DateTimeOffset.UtcNow);
        }
    }
    
    public async Task<PagedResult<CanonicalAsset>> GetAssetsAsync(
        SyncRequest request, CancellationToken ct)
    {
        var allAssets = new List<CanonicalAsset>();
        var page = 1;
        bool hasMore;
        
        do
        {
            var response = await _http.GetAsync<CityworksAssetPage>(
                $"/Services/AMS/Entity/Search?PageNum={page}&PageSize={request.PageSize}" +
                (request.ChangedSince.HasValue 
                    ? $"&UpdatedSince={request.ChangedSince:O}" 
                    : ""),
                ct);
            
            // Enrich with GIS geometry
            var entityUids = response.Items.Select(a => a.EntityUID).Where(u => u != null).ToList();
            var geometries = await _gis.GetGeometriesAsync(
                _config.EsriFeatureServiceUrl, entityUids, ct);
            
            foreach (var item in response.Items)
            {
                var canonical = _mapper.Map(item);
                if (geometries.TryGetValue(item.EntityUID, out var geom))
                    canonical = canonical with { Geometry = geom };
                allAssets.Add(canonical);
            }
            
            hasMore = response.Items.Count == request.PageSize;
            page++;
        } while (hasMore && !ct.IsCancellationRequested);
        
        return new PagedResult<CanonicalAsset>(allAssets, null, allAssets.Count, false);
    }
    
    public async Task<PagedResult<CanonicalWorkOrder>> GetWorkOrdersAsync(
        SyncRequest request, CancellationToken ct)
    {
        // Same pattern as GetAssetsAsync — omitted for brevity
        throw new NotImplementedException();
    }
    
    public Task<PagedResult<CanonicalPmSchedule>> GetPmSchedulesAsync(
        SyncRequest request, CancellationToken ct)
        => Task.FromResult(new PagedResult<CanonicalPmSchedule>([], null, 0, false));
        // Cityworks does not have a separate PM schedule object — PMs are work order templates
    
    public Task<PagedResult<CanonicalDefect>> GetDefectsAsync(
        SyncRequest request, CancellationToken ct)
    {
        // Map Cityworks ServiceRequests to CanonicalDefects
        throw new NotImplementedException();
    }
    
    public Task<CreateResult> CreateWorkOrderAsync(
        CanonicalWorkOrder workOrder, CancellationToken ct)
    {
        // Hybrid Mode only
        throw new NotImplementedException();
    }
    
    public Task<UpdateResult> UpdateWorkOrderStatusAsync(
        string eamNativeId, WorkOrderStatus status, CancellationToken ct)
        => throw new NotImplementedException();
}
```
