# Posify

A modern Point of Sale system built with Next.js, PostgreSQL, and Electron.

## 🚀 Features

- **POS Interface** - Fast and intuitive sales interface
- **Product Management** - Categories, inventory tracking
- **Customer Management** - Customer database, credit limits, ledger
- **Sales & Purchases** - Complete transaction management
- **Expenses** - Track business expenses
- **Double-Entry Accounting** - Full accounting system
- **Reports** - Sales, purchases, stock, profit/loss reports
- **Multi-User** - Role-based access (Admin, Manager, User)
- **Desktop App** - Electron-based desktop application
- **Web App** - Cloud-accessible web application

## 📋 Prerequisites

- Node.js 18+ (recommended: 20+)
- PostgreSQL 14+
- npm or yarn

## 🛠️ Installation

### 1. Clone and Install Dependencies

```bash
cd /Users/dev/Desktop/pos
npm install
```

### 2. Configure Database

Create a PostgreSQL database:

```sql
CREATE DATABASE posify;
```

Update `.env.local` with your database credentials:

```env
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/posify?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"
```

### 3. Run Database Migrations

```bash
# Push schema to database
npm run db:push

# Seed with sample data
npm run db:seed

# Or use migrations (recommended for production)
npm run db:migrate
```

### 4. Start Development Server

```bash
# Web development
npm run dev

# Open http://localhost:3000
```

## 🖥️ Desktop App (Electron)

### Development

```bash
# Start Next.js dev server first
npm run dev

# In another terminal, start Electron
npm run electron:dev
```

### Build for Production

```bash
# Build for current platform
npm run electron:build

# Build for specific platform
npm run electron:build:win    # Windows
npm run electron:build:mac    # macOS
npm run electron:build:linux  # Linux
```

## 👤 Default Users

After seeding, you can login with:

| Role | Username | Password |
|------|----------|----------|
| Administrator | admin | admin123 |
| Manager | manager | manager123 |
| User | user | user123 |

## 📁 Project Structure

```
pos/
├── electron/           # Electron main process
│   ├── main.js        # Main electron file
│   └── preload.js     # Preload script
├── prisma/
│   ├── schema.prisma  # Database schema
│   └── seed.ts        # Database seeder
├── src/
│   ├── app/           # Next.js app router
│   │   ├── api/       # API routes
│   │   ├── (dashboard)/ # Protected routes
│   │   └── login/     # Login page
│   ├── components/    # React components
│   │   └── layout/    # Layout components
│   ├── lib/           # Utilities
│   │   ├── prisma.ts  # Prisma client
│   │   └── auth.ts    # NextAuth config
│   ├── store/         # Zustand stores
│   ├── theme/         # MUI theme
│   └── types/         # TypeScript types
└── public/            # Static files
```

## 🔧 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run db:push` | Push schema to database |
| `npm run db:migrate` | Run migrations |
| `npm run db:seed` | Seed database |
| `npm run db:studio` | Open Prisma Studio |
| `npm run electron:dev` | Start Electron in dev mode |
| `npm run electron:build` | Build Electron app |

## 🗄️ Database Schema

### Core Tables
- `users` - User accounts and authentication
- `stores` - Store/branch information
- `products` - Product catalog
- `categories` - Product categories
- `customers` - Customer database
- `suppliers` - Supplier database

### Transactions
- `sales` - Sales transactions
- `sale_items` - Sale line items
- `purchases` - Purchase transactions
- `purchase_items` - Purchase line items
- `payments` - Payment records
- `expenses` - Expense tracking

### Accounting
- `account_groups` - Account group hierarchy
- `accounts` - Chart of accounts
- `transactions` - Double-entry transactions
- `customer_ledgers` - Customer ledger entries
- `supplier_ledgers` - Supplier ledger entries

## 🔒 Security

- Passwords hashed with bcrypt
- JWT-based session management
- Role-based access control (RBAC)
- API routes protected by middleware

## 📱 Mobile Support

The web app is responsive and works on tablets and mobile devices.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

MIT License - see LICENSE file for details.

---

Built with ❤️ by Posify
