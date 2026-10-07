# Vidhyarthi Book Depot

Run both apps from this project root:

```powershell
npm run dev
```

The command starts the Next.js storefront at [http://localhost:3000](http://localhost:3000) and the backend at [http://localhost:4000](http://localhost:4000). If port 3000 is busy, Next.js may choose another port and print its address. Missing app dependencies are installed from each app's pnpm lockfile on the first run; the command you use to start both apps remains `npm run dev`.

The frontend proxies `/api/store/*` to the backend. Catalog, search, product and category pages, cart quotes, and principal admin screens use backend APIs. Without `DATABASE_URL`, public pages use the sample catalog; admin sign-in needs PostgreSQL. Checkout cannot place an order or take payment until Razorpay and fulfilment settings are connected.

See [backend/README.md](backend/README.md) for migration and `.env` setup. Never commit `backend/.env`.
