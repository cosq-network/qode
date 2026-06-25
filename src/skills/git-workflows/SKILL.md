---
name: git-workflows
description: "Git workflow skill covering clone, checkout, merge, tag, diff, cherry-pick, and log."
tags: [git, version-control, workflows]
---

Use the installed git tools for repository work:
- git_clone(url, directory?, branch?)
- git_manage_branch(action='checkout', branchName)
- git_merge(branch, noFF?, noCommit?, message?)
- git_manage_tag(action='create'|'list'|'delete', tagName?, message?)
- git_diff(file?, staged?, compareFrom?, compareTo?)
- git_cherry_pick(commit, noCommit?)
- git_log(limit?, fromCommit?, toCommit?, file?)
