# 09 — GraphQL Integration

## When to Use GraphQL

Most EAM integrations use REST. GraphQL is relevant in a small but growing set of scenarios:

1. **IBM MAS 8.10+** exposes a GraphQL API for asset and work order data. It is available alongside the OSLC REST API. For new MAS integrations, GraphQL is preferred because it allows precise field selection, reduces over-fetching, and supports real-time subscriptions via WebSocket.

2. **Internal microservice APIs** in the Aurigo platform may expose GraphQL for dashboard aggregation queries that span multiple domains. The integration gateway can query these internally using GraphQL.

3. **Customer self-service portals** that expose GraphQL endpoints for their own data — rare, but present in some large agencies with mature data platform teams.

Choose REST over GraphQL when: the EAM uses REST exclusively, the adapter is maintained by a small team with limited GraphQL experience, or the EAM's GraphQL schema is poorly documented. GraphQL adds a learning curve; it is only worth it when the field selection or subscription benefits are concrete.

## GraphQL Client in .NET

Two options exist for .NET GraphQL clients:

**StrawberryShake** (Hot Chocolate ecosystem): Generates strongly-typed C# client code from GraphQL schema and operation files. The generated client is similar in quality to the `openapi-typescript` generated client — type-safe, no string-based queries, and IntelliSense support.

**GraphQL.Client** (simple, flexible): Suitable for quick integrations where schema-generated clients are overkill. Uses runtime string-based queries, less type safety.

For IBM MAS integration, use StrawberryShake. For ad-hoc internal queries, GraphQL.Client is acceptable.

### StrawberryShake Setup

Install packages:
```xml
<PackageReference Include="StrawberryShake.Transport.Http" Version="13.9.0" />
<PackageReference Include="StrawberryShake.CodeGeneration.MSBuild" Version="13.9.0" />
```

Configure the code generator in `.graphqlrc.json`:
```json
{
  "schema": "schema.graphql",
  "documents": "**/*.graphql",
  "extensions": {
    "strawberryShake": {
      "name": "MasEamClient",
      "namespace": "Aurigo.AssetMaintenance.Infrastructure.EamAdapters.Maximo",
      "url": "https://{mas-host}/graphql"
    }
  }
}
```

## Introspection and Client Generation

Before generating the typed client, introspect the GraphQL schema from the MAS server:

```bash
dotnet graphql download https://{mas-host}/graphql \
  --header "Authorization: Bearer {token}" \
  --output schema.graphql
```

After schema download, write your operation files and build the project — StrawberryShake generates the C# client classes automatically on build.

## Fragment-Based Queries for Efficient Field Selection

The key advantage of GraphQL over REST is requesting only the fields you need. This reduces payload size and server processing time significantly for EAM systems with wide tables (Maximo ASSET has 200+ columns).

Define reusable fragments for each canonical type:

```graphql
# Operations/GetAssets.graphql

fragment AssetCore on Asset {
  assetNum
  description
  assetType
  serialNum
  siteId
  status
  installDate
  manufacturer
  expectedLife
  replaceCost
  changeDate
  location {
    location
    description
    siteid
  }
  classStructure {
    classstructureid
    classificationid
    description
  }
}

query GetChangedAssets($siteId: String!, $changedSince: DateTime!, $pageSize: Int!, $page: Int!) {
  assetsList(
    filter: {
      siteid: { eq: $siteId }
      changedate: { gt: $changedSince }
    }
    first: $pageSize
    offset: $page
  ) {
    totalCount
    hasNextPage
    items {
      ...AssetCore
    }
  }
}
```

The `AssetCore` fragment captures exactly the fields that map to `CanonicalAsset`. If a new canonical field is added, add it to the fragment, regenerate the client, and the mapping is updated automatically.

## Subscription Support for Real-Time Events

GraphQL subscriptions use WebSocket transport. IBM MAS (and other modern EAM systems that expose GraphQL) use subscriptions for real-time change notification.

```graphql
# Subscriptions/AssetChanges.graphql

subscription WatchAssetChanges($siteId: String!) {
  assetChanged(filter: { siteid: { eq: $siteId } }) {
    changeType  # CREATED | UPDATED | DELETED
    asset {
      ...AssetCore
    }
  }
}
```

Subscription client implementation with StrawberryShake:

```csharp
public class MasSubscriptionHandler : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var subscription = _masClient.WatchAssetChanges
            .Watch(siteId: "BOSTON")
            .Subscribe(
                onNext: result =>
                {
                    if (result.IsSuccessResult())
                    {
                        var data = result.Data!.AssetChanged;
                        _syncQueue.Enqueue(new AssetChangeEvent
                        {
                            ChangeType = data.ChangeType,
                            Asset = _mapper.Map(data.Asset)
                        });
                    }
                },
                onError: ex => _logger.LogError(ex, "Subscription error"),
                stoppingToken);
        
        await Task.Delay(Timeout.Infinite, stoppingToken);
    }
}
```

Subscriptions provide sub-second latency for asset changes — far better than polling. However, subscriptions require persistent WebSocket connections and are more complex to operate. Use subscriptions only for customers on MAS 8.10+ where the GraphQL subscription endpoint is stable.

## IBM MAS GraphQL Example

IBM MAS exposes GraphQL at `/maximo/graphql`. The schema is auto-generated from the Maximo object structure.

```graphql
# Get all road and bridge assets changed since a timestamp
query GetInfrastructureAssets($changedSince: DateTime!) {
  assetsList(
    filter: {
      changeby: { ne: "MAXADMIN" }  # exclude system changes
      changedate: { gt: $changedSince }
      assettype: { in: ["ROAD", "BRIDGE", "CULVERT"] }
      status: { eq: "OPERATING" }
    }
    first: 200
    orderBy: { changedate: ASC }
  ) {
    totalCount
    hasNextPage
    items {
      assetnum
      description
      assettype
      serialnum
      siteid
      installdate
      manufacturer
      expectedlife
      replacecost
      changedate
      assetspec {
        assetattrid
        alnvalue
        numvalue
        measureunitid
      }
    }
  }
}
```

Note the `assetspec` sub-selection — this retrieves asset attribute specifications (custom fields) in the same query, avoiding a separate round-trip. In REST OSLC, fetching asset specs requires a separate query to `ASSET_SPEC` for each asset.

## Error Handling

GraphQL error handling differs from REST. A GraphQL response can have both `data` and `errors` simultaneously — a partial success where some fields succeeded and others failed (e.g., a permission error on one field).

### GraphQL Errors vs HTTP Errors

```csharp
var result = await _masClient.GetChangedAssets.ExecuteAsync(
    siteId: "BOSTON", changedSince: lastSync, pageSize: 200, page: 0);

// HTTP-level error (connection failure, timeout)
if (result.IsErrorResult())
{
    _logger.LogError("GraphQL transport error: {Errors}", result.Errors);
    throw new EamSyncException("GraphQL transport failure");
}

// GraphQL-level errors (field access denied, validation error)
if (result.Errors?.Any() == true)
{
    foreach (var error in result.Errors)
    {
        _logger.LogWarning("GraphQL partial error: {Message} at {Path}",
            error.Message, string.Join(".", error.Path ?? []));
    }
    // If data is still present (partial success), continue with available data
}

// Process the data that succeeded
var assets = result.Data?.AssetsList?.Items ?? [];
```

### Handling Partial Success

GraphQL allows a query to return data for most fields and errors for a few (e.g., if the service account lacks authorization for a specific field). The Maintain adapter accepts partial success: map the fields that are present, log the field errors, and continue. Do not fail the entire sync because one field returned an authorization error.

If a required canonical field (EamNativeId, Name) is missing, skip the record and log it as a `parse_error`. If optional fields are missing due to permissions, map with null and log a one-time warning.

## Introspection Security Note

GraphQL introspection (the `__schema` query) reveals the entire API schema. Many production GraphQL APIs disable introspection for security. IBM MAS restricts introspection to authenticated users. Always authenticate before attempting schema introspection. Store the downloaded `schema.graphql` file in source control so it can be used for client generation without re-introspecting in CI/CD.
