# Raspberry Pi Git Commands Reference

## First-Time Setup (only once)

```bash
# Clone the repository
git clone https://github.com/<your-org>/<your-repo>.git ~/project-tabang
cd ~/project-tabang

# Set your git identity
git config --global user.name "<your-name>"
git config --global user.email "<your-email@example.com>"

# Save credentials so you don't re-enter them every time
git config --global credential.helper store
```

---

## Updating the Code (do this after every push from your laptop)

```bash
cd ~/project-tabang
git pull origin main
```

Then rebuild if you changed TypeScript/React:
```bash
npm run build -w packages/backend
npm run build -w packages/frontend
```

Then restart services:
```bash
sudo systemctl restart tabang-emulators tabang-fingerprint tabang-frontend
```

---

## Ask to Pull Updates Every Pi Login

Use the helper script:

```bash
cd ~/project-tabang
chmod +x scripts/raspi-login-update-prompt.sh
```

Add this to the bottom of `~/.bashrc`:

```bash
if [ -t 0 ] && [ -x "$HOME/project-tabang/scripts/raspi-login-update-prompt.sh" ]; then
  "$HOME/project-tabang/scripts/raspi-login-update-prompt.sh"
fi
```

Every time you open a terminal or SSH into the Raspberry Pi, it will ask:

```text
Pull latest updates from origin/main now? [y/N]
```

For the production kiosk, this is enough because the frontend is the deployed
website and the Pi only needs updated fingerprint-service code. If you are
running a local frontend on the Pi, add this before the script block:

```bash
export TABANG_BUILD_LOCAL_FRONTEND=1
```

---

## Useful Everyday Commands

| Task | Command |
|------|---------|
| Check current status | `git status` |
| See recent commits | `git log --oneline -10` |
| See what branch you're on | `git branch` |
| Discard local changes and force-sync | `git fetch origin && git reset --hard origin/main` |
| Check which remote is configured | `git remote -v` |

---

## If `git pull` Fails

**Uncommitted local changes blocking the pull:**
```bash
git stash
git pull origin main
git stash pop
```

**Or discard local changes entirely (careful: this is permanent):**
```bash
git reset --hard origin/main
```

**Merge conflict:**
```bash
git status
# Edit conflicted files, look for <<<<<<< markers
git add .
git commit -m "Resolve merge conflicts"
```

---

## Credentials

- **GitHub username:** your GitHub account or org member account
- **Password:** use a Personal Access Token (not your GitHub password)
- **Repo URL:** `https://github.com/<your-org>/<your-repo>.git`

After running `git config --global credential.helper store`, your credentials are saved after the first successful pull, so you should not be asked again.
