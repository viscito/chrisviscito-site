# chrisviscito.com — Setup Guide

No coding or Terminal needed. Everything below uses **GitHub Desktop**, a free app with a normal point-and-click interface.

---

## What you'll need
- Your GitHub account (already have)
- chrisviscito.com (already secured)
- The `chrisviscito-site.zip` file I gave you
- 15–20 minutes

---

## Step 1 — Install GitHub Desktop
1. Go to **desktop.github.com**
2. Click **Download for macOS**
3. Open the downloaded file and drag **GitHub Desktop** into **Applications**
4. Open GitHub Desktop → **Sign in to GitHub.com** → log in and authorize it

---

## Step 2 — Create the repository on GitHub
1. In your browser, go to **github.com** and sign in
2. Click the **+** icon top-right → **New repository**
3. **Repository name:** `chrisviscito-site`
4. Set visibility to **Public**
5. Leave every checkbox unchecked (no README, no .gitignore — we already have our own files)
6. Click **Create repository**

---

## Step 3 — Bring the site onto your Mac
1. Find `chrisviscito-site.zip` in your **Downloads** folder and double-click it to unzip
2. In GitHub Desktop: **File → Clone Repository**
3. Click the **GitHub.com** tab, select **chrisviscito-site**, choose where to save it (Documents is fine), click **Clone**
4. In GitHub Desktop: **Repository → Show in Finder** — this opens the empty cloned folder
5. From the unzipped folder, drag everything (`index.html`, `CNAME`, `README.md`, the `assets` folder) into that cloned folder

---

## Step 4 — Publish it to GitHub
1. Switch back to **GitHub Desktop** — it now lists the files you added
2. In the box bottom-left, type a summary, e.g. `Add site files`
3. Click **Commit to main**
4. Click **Push origin** (top of the window)

Your files are now on GitHub.

---

## Step 5 — Turn on GitHub Pages
1. On github.com, open your **chrisviscito-site** repository
2. Click **Settings** (top tab)
3. In the left sidebar, click **Pages**
4. Under **Build and deployment → Source**, choose **Deploy from a branch**
5. **Branch:** `main`, folder: `/ (root)` → click **Save**
6. Wait about a minute, refresh the page — you'll see your live link (something like `https://your-username.github.io/chrisviscito-site/`). Open it to confirm the site loads.

---

## Step 6 — Connect chrisviscito.com
1. Still in **Settings → Pages**, find the **Custom domain** field
2. Type `chrisviscito.com` → click **Save**
3. Log into whoever you bought the domain from (Namecheap, GoDaddy, Google Domains, etc.) and find **DNS settings** / **Manage DNS**
4. Add **four A records**, host/name field set to `@`, one IP address each:
   ```
   185.199.108.153
   185.199.109.153
   185.199.110.153
   185.199.111.153
   ```
5. Add **one CNAME record**: host `www`, pointing to `your-username.github.io`
6. Save. DNS changes usually take a few minutes, occasionally up to 24 hours
7. Back in GitHub **Settings → Pages**, check **Enforce HTTPS** once the box becomes clickable (may need to wait and refresh)

Your site is now live at chrisviscito.com.

---

## Whenever you want to update the site
1. Edit files in the cloned folder (swap in real audio, headshot, bio text, etc.)
2. Open **GitHub Desktop** — it shows what changed
3. Type a summary → **Commit to main** → **Push origin**

Changes go live within a minute or two.

---

## Adding your real content
See the file list and placeholder notes in `index.html` — anything marked `[Replace...]` or "placeholder" is meant to be swapped out (bio, headshot, demo MP3s in `assets/audio`, client logos, testimonials, contact email, social links, and the Web3Forms access key for the contact form). Ask me anytime if you'd like help with any of it.

### Connecting the contact form (Web3Forms)
The contact form submits to [Web3Forms](https://web3forms.com), a free service that emails you every submission — no account/dashboard login required, just an access key sent to your inbox.

1. Go to **web3forms.com** and enter the email address you want submissions delivered to
2. Check that inbox for your **Access Key**
3. In `index.html`, find the contact form and replace `your-web3forms-access-key` in the hidden `access_key` field with your real key
4. Commit and push — the form is now live
