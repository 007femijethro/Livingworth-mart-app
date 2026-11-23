# Livingworth Mart

First merchant pilot for Rehoboth Supermarket.

Mobile-friendly web pilot for one checkout device. It stores records in the current browser, works offline after the first successful load, and can be installed from supported Android browsers. Use sample data for this pilot. Each shift and sale records the signed-in staff member. Refunds, camera barcode scanning, and backups are future work.

## Run locally

Run `python3 -m http.server 8000 --directory docs` and open `http://localhost:8000`.

## Deploy automatically from GitHub

Push the repository to GitHub. In repository **Settings → Pages**, choose **Deploy from a branch**, then select **main** and **/docs** and save. GitHub Pages rebuilds after updates to the publishing branch. The Pages settings show the test URL once the deployment succeeds. This setup requires a repository and account plan eligible for Pages.

## Staff accounts

Create the admin account on first launch. If this browser previously had an admin PIN, the setup asks for that PIN. Sign in as admin and use **Staff** to create or disable sellers and reset passwords. Sellers can record sales and handle cash shifts. Admins manage stock and see full reports.

Accounts and records are stored in the current browser. This pilot uses local access checks. Production and multi-device use require a server-side identity and authorization system.
