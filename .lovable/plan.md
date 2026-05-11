# Plan: Projecten als centrale werklaag + Offertes/Facturen

Behoud alle bestaande data. Geen rebuild — uitbreiding waarbij **projecten** de centrale entiteit worden tussen klanten en operationele data.

## 1. Database wijzigingen (migratie)

### Nieuwe enums
- `project_status`: `planned`, `active`, `on_hold`, `completed`
- `quote_status`: `draft`, `sent`, `approved`, `rejected`
- `invoice_status`: `to_send`, `sent`, `paid`, `overdue`

### Nieuwe tabellen

**`projects`**
- `id`, `name`, `customer_id` (FK customers, NOT NULL), `status`, `description`
- `assigned_to uuid[]` (verantwoordelijken)
- `created_by`, `created_at`, `updated_at`

**`quotes`** (offertes)
- `id`, `number` (auto), `customer_id` (NOT NULL), `project_id` (optioneel)
- `status quote_status`, `amount numeric`, `issue_date`, `notes`
- `created_by`, timestamps

**`invoices`** (facturen)
- `id`, `number` (auto), `customer_id` (NOT NULL), `project_id` (NOT NULL)
- `status invoice_status`, `amount numeric`, `issue_date`, `due_date`, `notes`
- `created_by`, timestamps

**`user_permissions`** (flexibele rechten per gebruiker)
- `user_id` (PK), `can_manage_customers bool`, `can_manage_projects bool`, `can_manage_tasks bool`, `can_view_quotes bool`, `can_edit_quotes bool`, `can_view_invoices bool`, `can_edit_invoices bool`
- Default false; admins krijgen automatisch alles via `is_admin()` check
- Helper functie `has_permission(uid, perm_name text)` die admin-bypass + lookup combineert

### Bestaande tabellen aanpassen
- `tasks`: voeg `project_id uuid` toe (nullable, want bestaande taken hebben er nog geen)
- `appointments`: voeg `project_id uuid` toe (nullable)
- `files`: nieuwe kolom `project_id uuid` toe; `customer_id` blijft (we verbergen file-tab in customer UI maar laten data staan)

### RLS policies
- `projects`: select = admin OR `auth.uid() = ANY(assigned_to)` OR created_by; insert/update/delete = admin OR created_by/assigned
- `quotes` / `invoices`: select/edit op basis van `has_permission()` + admin
- `user_permissions`: select = admin of self; update = admin only

### Triggers
- `set_updated_at` op nieuwe tabellen
- Auto-nummering offertes/facturen via sequence (Q-2026-0001 / F-2026-0001)
- `log_activity` triggers op projects/quotes/invoices

### Data migratie
- Bestaande data blijft intact. Geen automatische backfill van project_id (taken/afspraken blijven gekoppeld aan klant tot user ze in een project plaatst).

## 2. Sidebar herstructurering

```
Dashboard
Taken
Klanten
Projecten      ← nieuw
Agenda
Offertes & Facturen  ← nieuw
Instellingen
```

## 3. Routes (nieuw / aangepast)

**Nieuw:**
- `/projects` (lijst + filter op status, klant, verantwoordelijke)
- `/projects/$id` met tabs: Overzicht / Taken / Afspraken / Bestanden / Facturen
- `/billing` (gecombineerde pagina met tabs Offertes / Facturen)

**Aangepast:**
- `/customers/$id`: bestanden-tab vervangen door **Projecten-tab** + **Offertes/Facturen-tab**
- `/tasks`: dialog krijgt project-selector (klant wordt afgeleid)
- `/calendar`: afspraak-dialog krijgt project-selector

## 4. UI componenten

Nieuwe componenten in `src/components/`:
- `ProjectStatusBadge`, `QuoteStatusBadge`, `InvoiceStatusBadge`
- `ProjectFormDialog`, `QuoteFormDialog`, `InvoiceFormDialog`
- `ProjectFilesTab`, `ProjectInvoicesTab`
- `PermissionsManager` (in settings, admin-only)

QuickActionsFab uitbreiden met "+ Project", "+ Offerte", "+ Factuur".
GlobalSearch uitbreiden met projects/quotes/invoices.

## 5. Rechten in UI

- `usePermissions()` hook → returnt object `{ canManageCustomers, canManageProjects, ... }` (admin = alles true)
- Sidebar items en routes worden geconditioneerd op rechten
- Settings-tab "Gebruikers" krijgt rechten-matrix per niet-admin gebruiker

## Volgorde uitvoer

1. Migratie (enums, tabellen, RLS, triggers, sequences) — wachten op approval
2. Types regeneren (automatisch na migratie)
3. Sidebar + routes + nieuwe componenten
4. Customer detail aanpassen (files-tab → projects-tab)
5. Tasks/Calendar dialogs uitbreiden met project-koppeling
6. Settings: rechten-matrix
7. FAB + GlobalSearch uitbreiden
