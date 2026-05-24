# Zoshley Coffee Shop

React + TypeScript + Supabase + Tailwind CSS.

## Environment

Create or edit [.env.local](.env.local) and paste your Supabase values there:

```bash
REACT_APP_SUPABASE_URL=your-supabase-url
REACT_APP_SUPABASE_ANON_KEY=your-supabase-anon-key
```

The app falls back to demo data if those values are missing.

## Supabase Schema

The full SQL schema is in [supabase/schema.sql](supabase/schema.sql). Paste that file into the Supabase SQL editor to create the tables, triggers, indexes, row-level security policies, and starter menu data used by the app.

The app expects these tables:

`menu_items`

- `id`
- `name`
- `description`
- `category`
- `price`
- `featured`
- `is_available`
- `image_url`
- `prep_time`

`orders`

- `id`
- `customer_name`
- `customer_phone`
- `customer_email`
- `fulfillment`
- `notes`
- `items` as JSONB
- `subtotal`
- `tax`
- `delivery_fee`
- `total`
- `status`
- `created_at`
- `updated_at`

## Scripts

- `npm start`
- `npm test`
- `npm run build`
- `npm run typecheck`
