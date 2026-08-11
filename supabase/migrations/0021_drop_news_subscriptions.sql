-- Reverts the news_subscriptions table added in 0020_ci_news_priority.sql —
-- the "daily intel to your inbox" subscribe feature was dropped before
-- Task 7 built its endpoint/UI. category/priority on news_items (also from
-- 0020) are unaffected and stay in place.

drop table if exists news_subscriptions;
