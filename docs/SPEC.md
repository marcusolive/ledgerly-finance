# Ledgerly: functional specification

Version 1.0 · November 2026 · Author: Marcus Oliveira

## 1. Goal

Give the finance team of a mid-size company one place to see cash, collect from customers, control what gets paid and when, keep departments within budget and close the quarter with a clear P&L. Every number on screen should lead to the records behind it.

## 2. Users

| Persona | Needs |
|---|---|
| CFO | Cash position, forecast risk, margins and approvals for large bills |
| Controller | Quarterly P&L, budget variance, approval policies |
| AR specialist | Track open and overdue invoices, send reminders, record payments |
| AP specialist | Route bills for approval and schedule payments on time |
| Department head | Budget used against the quarter plan |

## 3. Scope

In scope for this demo: the seven screens below, client-side forecast scenarios, invoice and bill workflows, currency conversion with fixed demo rates and CSV export.
Out of scope: authentication, real bank feeds, ledger posting, persistence after reload.

## 4. Functional requirements

| ID | Requirement |
|---|---|
| FR-01 | The overview shows cash balance, revenue MTD, expenses MTD and net margin, each with trend and sparkline. An expense increase is shown as negative. |
| FR-02 | The revenue vs expenses chart switches between 6 and 12 months and shows both series in a hover tooltip. |
| FR-03 | The overview lists the next payments (approved, scheduled or pending bills) and alerts for overdue invoices, budget overruns, pending approvals and forecasts below minimum cash. Each alert opens the related screen, already filtered. |
| FR-04 | The cash forecast shows four weeks of actuals as a solid line and 13 forecast weeks as a dashed line, with the minimum cash policy as a reference line. |
| FR-05 | Choosing the base, conservative or optimistic scenario recalculates the forecast line, weekly bars, KPIs, assumptions and weekly table. |
| FR-06 | Weekly cash movement shows net flow (negative weeks in red), inflows or outflows. |
| FR-07 | The invoices table supports text filter, status and customer filters, sorting and pagination; overdue rows show days late. |
| FR-08 | Clicking an invoice opens its detail with line items and history. "Send reminder" records the reminder; "Mark as paid" sets status to Paid, adds the amount to the operating account and updates KPIs, aging, badges and alerts. |
| FR-09 | Aging groups the open balance in 0–30, 31–60, 61–90 and 90+ days outstanding. |
| FR-10 | A new invoice requires a positive amount; it gets the next number and status Open (or Overdue if already past due). |
| FR-11 | Bills follow Pending approval → Approved → Scheduled → Paid. The bill dialog shows the step, the applicable approval limit and only the next valid action. |
| FR-12 | Scheduling a payment requires a date from today onwards and a source account. When auto-schedule is on, approval schedules the bill for its due date. |
| FR-13 | Budget bars turn amber from 90% and red above 100%. Editing a budget requires a positive amount and updates totals and alerts. |
| FR-14 | The P&L compares the selected closed quarter with the previous one, showing change and % of revenue, and exports to CSV in the reporting currency. |
| FR-15 | Changing the reporting currency converts every amount; changing the fiscal year start relabels quarters. |
| FR-16 | Global search (shortcut `/`) jumps to a matching invoice, customer, bill, vendor or department. |

## 5. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-01 | No external dependencies besides web fonts; loads as static files. |
| NFR-02 | Usable from 360 px wide screens without horizontal page scroll; navigation collapses into a menu below 860 px. |
| NFR-03 | Dialogs are reachable by keyboard and close with `Esc`; switches expose `role="switch"` and `aria-checked`; budget bars expose `role="progressbar"`; icon buttons have labels. |
| NFR-04 | Sample data is deterministic (seeded) so screenshots and tests are repeatable. Dates are relative to the current day. |

## 6. User stories and acceptance criteria

**US-01 Record a customer payment**
As an AR specialist, I want to mark an invoice as paid so that receivables and cash stay accurate.
- Given an overdue invoice, when I choose "Mark as paid", then its status becomes Paid, the overdue badge count drops by one and a confirmation toast is shown.
- Given a paid invoice, when I open it, then the only action is "Close".

**US-02 Approve and schedule a bill**
As an AP specialist, I want approved bills scheduled on a date I choose so that we pay on time without hurting cash.
- Given a bill above the CFO limit, when I open it, then a note says CFO approval is required.
- Given an approved bill, when I pick a date in the past, then the dialog stays open and asks for a valid date.

**US-03 Cash risk**
As a CFO, I want to know when a scenario breaks the minimum cash policy so that I can act early.
- Given the conservative scenario falls below the policy, then the overview shows an alert with the lowest balance and week, and "Review" opens the cash flow screen on that scenario.

**US-04 Budget control**
As a department head, I want to see when my spend passes the budget.
- Given a department above 100%, then its bar and percentage are red and it is listed in the overview alerts.

## 7. Data model (simplified)

```
Invoice     { id, customer, email, issue, due, terms, amount, status: Paid|Open|Overdue, paidOn, reminders }
Bill        { id, vendor, category, dept, received, due, amount, status: Pending approval|Approved|Scheduled|Paid, payDate, approver }
Department  { name, code, owner, budget, actual }
Week        { start, actual, inflow, outflow }  → balance computed per scenario
Month       { revenue, services, cogs, rd, sm, ga }  → P&L computed per quarter
Bank        { name, account, mask, type, balance, status, synced }
```

## 8. Production architecture (reference)

```
Browser ──> Finance API (.NET / Node) ──> General ledger (PostgreSQL)
                    │                  ──> AR / AP / Budgets modules ──> Approval rules + audit log
                    │                  ──> Forecast service (13-week roll-forward)
                    └──> Bank feeds (open banking aggregator) ──> Reconciliation ──> Cash position
```
