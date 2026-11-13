# Database backups

Every night at 03:17 (Oman time) GitHub makes an encrypted copy of the Hamlaty database and keeps it for 90 days.
You can also run it any time: GitHub → Actions → **Database backup** → **Run workflow**.

What is included: all Hamlaty data (businesses, requests, quotes, price lists, ads, settings), sign-in accounts,
and the records of stored files. Not included: the files themselves (commercial registrations, pictures).

## Set up (once)

1. Supabase → your project → **Connect** → **Session pooler** → copy the connection string. Replace
   `[YOUR-PASSWORD]` with the database password (Supabase → Project Settings → Database → reset it if you don't
   have it).
2. GitHub → the Hamlaty repository → **Settings → Secrets and variables → Actions → New repository secret**:
   - `SUPABASE_DB_URL`: the connection string from step 1.
   - `BACKUP_PASSPHRASE`: a long password (16+ characters) that you write down and keep somewhere safe.
     Without it no one, including you, can open the backups.
3. GitHub → **Actions → Database backup → Run workflow**, and check that it finishes green.

## Download a backup

GitHub → **Actions → Database backup** → open a run → **Artifacts** → download `hamlaty-db-YYYY-MM-DD`.

## Restore (a developer does this)

```bash
gpg --decrypt hamlaty-YYYY-MM-DD.dump.gpg > hamlaty.dump          # asks for BACKUP_PASSPHRASE
pg_restore --list hamlaty.dump | head                            # check it opens
# Into a new, empty Supabase project (never over the live one without a fresh backup first):
pg_restore --no-owner --no-privileges --schema=public -d "postgresql://...new project..." hamlaty.dump
```
