"""Create GitHub issues (and add them to a GitHub Project) from backlog.csv.

Needs the GitHub CLI, signed in:  gh auth login
Usage (from the repo folder):
  python business/tracking/create_github_issues.py --repo OWNER/REPO --project 1 --owner OWNER
  add --dry-run first to see what would be created.

Creates labels for type, epic and priority, one milestone per sprint, and one
issue per backlog row. Rows whose title already exists as an issue are skipped,
so it is safe to run again.
"""
import argparse, csv, json, subprocess
from pathlib import Path

HERE = Path(__file__).parent
SPRINT_DUE = {  # last day of each sprint (YYYY-MM-DD)
    "S1": "2026-11-13", "S2": "2026-11-27", "S3": "2026-12-11", "S4": "2027-01-08", "S5": "2027-01-22",
    "S6": "2027-02-05", "S7": "2027-02-19", "S8": "2027-03-05", "S9": "2027-03-19", "S10": "2027-04-02",
    "S11": "2027-04-16", "S12": "2027-04-30",
}

def gh(args, dry):
    print("gh", " ".join(args))
    if dry:
        return ""
    return subprocess.run(["gh", *args], check=True, capture_output=True, text=True).stdout

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", required=True)
    ap.add_argument("--project", help="GitHub Project number (optional)")
    ap.add_argument("--owner", help="Project owner (user or org), needed with --project")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    rows = list(csv.DictReader(open(HERE / "backlog.csv", encoding="utf-8")))
    existing = set()
    if not a.dry_run:
        out = gh(["issue", "list", "--repo", a.repo, "--state", "all", "--limit", "500", "--json", "title"], False)
        existing = {i["title"] for i in json.loads(out or "[]")}

    labels = sorted({l for r in rows for l in r["Labels"].split(";")})
    for l in labels:
        try:
            gh(["label", "create", l, "--repo", a.repo, "--force"], a.dry_run)
        except subprocess.CalledProcessError:
            pass
    for s, due in SPRINT_DUE.items():
        try:
            gh(["api", f"repos/{a.repo}/milestones", "-f", f"title={s}", "-f", f"due_on={due}T17:00:00Z"], a.dry_run)
        except subprocess.CalledProcessError:
            pass  # milestone exists

    for r in rows:
        title = f"[{r['ID']}] {r['Title']}"
        if title in existing:
            continue
        body = (f"**Epic:** {r['Epic']}  \n**Priority:** {r['Priority']} · **Points:** {r['Story Points']} (~{r['Hours (est.)']} h)  \n"
                f"**Owner:** {r['Owner']}  \n**Depends on:** {r['Depends On'] or 'nothing'}  \n**Requirements:** {r['Requirements']}\n\n"
                f"### Acceptance criteria\n{r['Acceptance Criteria']}\n\n### Definition of Done\nSee business/05-project-plan.md, section 6.")
        args = ["issue", "create", "--repo", a.repo, "--title", title, "--body", body]
        for l in r["Labels"].split(";"):
            args += ["--label", l]
        if r["Sprint"] in SPRINT_DUE:
            args += ["--milestone", r["Sprint"]]
        url = gh(args, a.dry_run).strip()
        if a.project and a.owner and url:
            gh(["project", "item-add", a.project, "--owner", a.owner, "--url", url], a.dry_run)

if __name__ == "__main__":
    main()
