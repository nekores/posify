# Tax Accounting in Posify

## Overview

Tax collected from customers is a **liability** that must be paid to the government. This document explains how tax is handled in the accounting system.

## How Tax Impacts Accounting

### 1. **Revenue (Sales Revenue)**
- Revenue is recorded **NET of tax** (subtotal - discount, WITHOUT tax)
- Tax is NOT part of revenue
- Example: Sale of Rs. 1,000 with 2.5% tax (Rs. 25)
  - Revenue recorded: Rs. 1,000 (NOT Rs. 1,025)
  - Tax recorded separately: Rs. 25

### 2. **Tax Payable (Liability Account)**
- Tax collected from customers is tracked in **Tax Payable** account (code: 2002)
- This is a liability account (you owe this money to the government)
- Tax Payable balance increases when tax is collected from sales
- Tax Payable balance decreases when tax is paid to government

### 3. **Profit Calculation**
- **Profit = Revenue - Expenses**
- Tax is NOT included in profit calculation
- Tax is a liability, not an expense
- Example:
  - Revenue: Rs. 1,000
  - COGS: Rs. 600
  - Tax Collected: Rs. 25 (liability, not expense)
  - **Profit = Rs. 1,000 - Rs. 600 = Rs. 400**

## Accounting Entries

### When a Sale is Made (with Tax)

**Example:** Sale of Rs. 1,000 with 2.5% tax (Rs. 25), total Rs. 1,025

**Double-Entry Transactions:**

1. **Cash Sale:**
   - Debit: Cash in Hand (Rs. 1,025) - Money received
   - Credit: Sales Revenue (Rs. 1,000) - Net revenue (without tax)
   - Credit: Tax Payable (Rs. 25) - Tax collected (liability)

2. **Credit Sale:**
   - Debit: Accounts Receivable (Rs. 1,025) - Money owed by customer
   - Credit: Sales Revenue (Rs. 1,000) - Net revenue (without tax)
   - Credit: Tax Payable (Rs. 25) - Tax collected (liability)

3. **Cost of Goods Sold:**
   - Debit: Cost of Goods Sold (Rs. 600) - Expense
   - Credit: Inventory (Rs. 600) - Reduces inventory value

### When Tax is Paid to Government

**Example:** Paying Rs. 1,000 tax to government

**Double-Entry Transaction:**
- Debit: Tax Payable (Rs. 1,000) - Reduces liability
- Credit: Cash/Bank (Rs. 1,000) - Money paid out

## Tax Payable Account

The **Tax Payable** account (code: 2002) tracks:
- **Credit balance** = Tax collected but not yet paid
- **Debit entries** = Tax paid to government
- **Credit entries** = Tax collected from sales

### Monthly/Annual Tax Payment

When you pay tax to the government (monthly or annually):

1. Create a transaction:
   - Debit: Tax Payable (amount paid)
   - Credit: Cash/Bank (amount paid)

2. This reduces your Tax Payable liability

## Reports

### Tax Management Page
- Shows tax collected (this year, last year, this month, last month)
- Calculated as: Sales Tax - Purchase Tax (net tax collected)
- This represents the tax you've collected and owe to the government

### Profit & Loss Statement
- **Revenue:** Net sales (without tax)
- **Expenses:** COGS, operating expenses
- **Tax Payable:** Shown as liability (not in P&L)
- **Net Profit:** Revenue - Expenses (tax not included)

## Important Notes

1. **Tax is NOT revenue** - It's money you're holding for the government
2. **Tax is NOT an expense** - It's a liability until paid
3. **Revenue is NET of tax** - Always record revenue without tax
4. **Tax Payable increases** when you collect tax from customers
5. **Tax Payable decreases** when you pay tax to government

## Example Scenario

**Month 1:**
- Sales: Rs. 10,000 (net revenue)
- Tax Collected: Rs. 250 (2.5%)
- Tax Payable balance: Rs. 250 (you owe this to government)

**Month 2:**
- Sales: Rs. 15,000 (net revenue)
- Tax Collected: Rs. 375 (2.5%)
- Tax Payable balance: Rs. 625 (Rs. 250 + Rs. 375)

**End of Month 2 - Pay Tax:**
- Pay Rs. 625 to government
- Tax Payable balance: Rs. 0

**Profit for 2 months:**
- Revenue: Rs. 25,000
- Expenses: (COGS, etc.)
- **Profit = Revenue - Expenses** (tax not included)

---

**Summary:** Tax collected is tracked separately as a liability. Revenue is always recorded net of tax, and profit calculations exclude tax. Tax Payable account shows how much tax you've collected and owe to the government.
