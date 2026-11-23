# Livingworth Mart

First merchant pilot for Rehoboth Supermarket.

Mobile-friendly web pilot for one checkout device. It stores records in the current browser, works offline after the first successful load, and can be installed from supported Android browsers. Use sample data for this pilot. Staff names are recorded at shift opening; user accounts, refunds, camera barcode scanning, and backups are future work.

## Run locally

Run `python3 -m http.server 8000 --directory docs` and open `http://localhost:8000`.

## Deploy automatically from GitHub

Push the repository to GitHub. In repository **Settings → Pages**, choose **Deploy from a branch**, then select **main** and **/docs** and save. GitHub Pages rebuilds after updates to the publishing branch. The Pages settings show the test URL once the deployment succeeds. This setup requires a repository and account plan eligible for Pages.
