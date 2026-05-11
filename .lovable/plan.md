# Plan: Werkplek → Neuritas-AI uitbreiding

Behoud alle bestaande data en structuur. Geen rebuild — uitbreiding en verfijning.

## 1. Branding & UI

- Logo `Neuritas-AI` toevoegen in `src/assets/` en gebruiken in:
  - Sidebar header (vervangt huidige briefcase-icoon + "Werkplek")
  - Loginpagina hero
  - Favicon / app icon (in `public/`)
  - Browser tab title → "Neuritas-AI"
- Design tokens in `src/styles.css` aanpassen:
  - Primary gradient: paars (#7C3AED) → blauw (#3B82F6) (afgeleid uit logo)
  - Nieuwe tokens: `--gradient-brand`, `--shadow-brand`, `--primary-glow`
  - Behoud Cloud White basis, maar accenten in brand-gradient
- UI-polish: meer whitespace, card-based layouts, gradient accent op primaire knoppen, badges en sidebar-actief item.

## 2. Rollen: Admin + Werknemer

Database:
- Enum `app_role` uitbreiden met `'employee'`
- Nieuwe trigger laat `handle_new_user` standaard `'admin'` blijven voor de eerste 2 bestaande accounts (al bestaand). Nieuwe accounts via admin-flow krijgen rol op basis van keuze.
- Kolom `customers.assigned_to uuid[]` (verantwoordelijke gebruikers)
- Kolom `tasks.assignee_id` bestaat al — verplicht maken bij employee-flow.
- RLS aanscherpen:
  - `tasks`: admin = alles, employee = alleen eigen `assignee_id` of `created_by`
  - `customers`: admin = alles, employee = alleen waar `auth.uid() = ANY(assigned_to)`
  - `appointments`: admin = alles, employee = alleen waar in `participants`
  - `files`: gekoppeld aan klant → zelfde regel als customers
- Helper SQL-functie `is_admin(uid)` (gebruikt `has_role`).

Admin UI in `/settings`:
- Tab "Gebruikers" — lijst, rol-toggle, nieuwe gebruiker aanmaken (via edge function met service role, omdat client-side signup geen rol kan zetten).
- Edge function `admin-create-user` (admin-only check via JWT).

## 3. Sidebar

- Verwijder "Bestanden" item uit nav.
- Volgorde: Dashboard, Taken, Klanten, Agenda, Instellingen.
- Toon huidige rol-badge onder gebruikersnaam.

## 4. Bestanden → in klantendossier

- Verwijder route `/files` (`src/routes/_app/files.tsx`) en routeTree-verwijzing.
- In `customers/$id` extra tab "Bestanden":
  - Upload (link aan klant + optioneel taak/afspraak via dropdown van klantgerelateerde items)
  - Lijst met download/preview, koppeling-badge zichtbaar.
- `files` tabel blijft hetzelfde; bucket `files` blijft.

## 5. Dashboard — rolgebaseerd

`/dashboard` rendert verschillend:
- **Admin**: Taken-per-gebruiker (gegroepeerd), urgente taken (<48u), komende afspraken, klanten met status `follow_up`, activiteitenfeed (laatste 20), quick actions.
- **Werknemer**: Mijn taken (gefilterd), mijn afspraken (gefilterd), urgente items, quick actions (taak/afspraak toevoegen).

Quick action knoppen openen bestaande Dialogs (taak/klant/afspraak).

## 6. Taken — uitbreiding

Bestaande velden blijven (status/priority/deadline/assignee/customer/tags). Toevoegen:
- View tabs: "Mijn taken" / "Vandaag" / "Deze week" / "Alle taken" (laatste alleen admin).
- Kanban view bestond al → opfrissen met kleurcodes per priority.
- Kleurcodering: status = kleur van kolom-/badge-rand; priority = badge.
- Reminder = notificatie aanmaken via DB trigger 24u vóór deadline (we doen simpele aanpak: bij dashboard-load checken en notifications inserten als ze nog niet bestaan).

## 7. Klanten — tabs

Refactor `customers/$id` naar tabbed layout:
- Overzicht (huidige info + assigned_to multi-select)
- Taken (gekoppelde taken)
- Afspraken (gekoppelde afspraken)
- Notities (bestaande timeline)
- Bestanden (zie sectie 4)

Snelle acties bovenin: + Taak, + Afspraak, + Bestand.

## 8. Agenda

- Standaardview = week (was al beschikbaar).
- Klik op afspraak opent Sheet/Dialog (detailpaneel) i.p.v. nieuwe pagina (al zo, polish).
- Kleurkeuze per afspraak via colorpicker preset (5 kleuren).
- Reminder-melding: notificatie 30 min vóór start (via dashboard-poll).

## 9. Notificaties

Bestaand `notifications` tabel hergebruiken. Insertion vanuit:
- Trigger: bij `tasks` insert/update naar assignee_id (status changes / nieuwe toewijzing).
- Trigger: bij `appointments` insert naar elke participant.
- Trigger: bij `customer_notes` insert naar klant `assigned_to`.

Badge in header bestond al. Polish: rolafhankelijk (employee ziet eigen, admin ziet alles waar `user_id = auth.uid()`).

## 10. Activiteitenlog

Nieuwe tabel `activity_log`:
- `actor_id, action, entity_type, entity_id, metadata jsonb, created_at`
- Triggers op tasks/customers/appointments/customer_notes voor INSERT/UPDATE.
- RLS: alleen admin kan SELECT.
- Weergave in admin dashboard (laatste 20).

## 11. Globale zoekbalk

- Header `Cmd/Ctrl+K` → Command Dialog (shadcn `command`).
- Zoekt parallel in `customers`, `tasks`, `appointments` (via `ilike` op title/name/description).
- Resultaten → klikken navigeert naar entiteit.

## 12. UX

- Sticky filterbar bovenaan tasks/customers (al deels — `top-0 sticky`).
- Floating action button (FAB) rechtsonder op mobile met "+" → opent menu (Taak/Klant/Afspraak).

## Technische details

- Migratie: enum-uitbreiding, kolommen, RLS-policies (drop + recreate), triggers, activity_log tabel + bucket-policies onveranderd.
- Edge function `admin-create-user` met `verify_jwt = true`, controleert admin via `user_roles`.
- Geen breaking changes voor bestaande accounts (blijven admin).
- Nieuwe imports / componenten in `src/components/` voor: `Logo`, `BrandButton`, `RoleBadge`, `GlobalSearch`, `Fab`, `ActivityFeed`, `UserManagementTab`, `CustomerFilesTab`.

## Volgorde uitvoer

1. Migratie (rol-enum, kolommen, RLS, triggers, activity_log) → wachten op approval.
2. Edge function admin-create-user.
3. Logo + design tokens + sidebar/header rebrand.
4. Sidebar nav update + verwijder Files-route.
5. Customer detail → tabs + bestanden-tab.
6. Dashboard rolgebaseerd + activity feed.
7. Tasks uitbreidingen (views, FAB).
8. Settings → user management.
9. Globale zoek (Cmd+K).
10. Polish + verificatie via build.