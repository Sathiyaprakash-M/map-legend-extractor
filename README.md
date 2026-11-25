# Map legend extractor (Netlify version)

Files: index.html, netlify.toml, netlify/functions/extract.mjs

Deploy (functions need a Git or CLI deploy; a plain drag-and-drop of index.html will not include them):

Option A, Netlify CLI
1. Install Node.js, then run: npm i -g netlify-cli
2. In this folder run: netlify login, then netlify deploy --prod
   (choose your existing site "maplegendextract" when asked)
3. In Netlify: Site configuration > Environment variables > add ANTHROPIC_API_KEY.
4. Run netlify deploy --prod again.

Option B, GitHub
1. Upload these files to a GitHub repository (keep the netlify/functions folder).
2. In Netlify choose Add new site > Import from Git, pick the repo (no build command, publish directory ".").
3. Add ANTHROPIC_API_KEY under Environment variables and redeploy.

Test: open https://YOUR-SITE.netlify.app/api/extract. You should see {"error":"Use POST."}.
