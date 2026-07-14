import subprocess
import os

def create_package():
    # Only diff the files relevant to Task 1
    files = ["scratch/generate_drawio.py", "docs/database/database_design.drawio"]
    
    # Get stat
    stat_cmd = ["git", "diff", "--cached", "--stat"] + files
    stat_res = subprocess.run(stat_cmd, capture_output=True, text=True, encoding="utf-8")
    
    # Get diff with context
    diff_cmd = ["git", "diff", "--cached", "-U10"] + files
    diff_res = subprocess.run(diff_cmd, capture_output=True, text=True, encoding="utf-8")
    
    output = []
    output.append("# Review package: Staged Local Changes\n")
    output.append("## Commits\nNone (Uncommitted staged files)\n")
    output.append("## Files changed\n" + stat_res.stdout + "\n")
    output.append("## Diff\n" + diff_res.stdout)
    
    out_path = ".superpowers/sdd/review-staged-task-1.diff"
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(output))
        
    print(f"Package written to: {out_path}")

if __name__ == "__main__":
    create_package()
