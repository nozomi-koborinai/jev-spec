# Security

jev-spec reads the files that a configuration names, and that configuration may come from a pull request nobody has reviewed yet. It also starts git with a revision range taken from the command line. Both inputs are treated as untrusted.

## Paths

### REQ-PATH-01: A path resolves inside the project root

A path is accepted only when its real path, with symbolic links resolved, lies inside the project root. Any other path is rejected with an error.

### REQ-PATH-02: Glob patterns stay relative to the project root

A glob pattern that is absolute, or that contains a `..` segment, is rejected before any file is matched.

### REQ-PATH-03: File matching does not follow symbolic links

When files are matched against glob patterns, symbolic links are not followed.

### REQ-PATH-04: Secrets are excluded from matching by default

Environment files, the `.git` directory and private key files are excluded from every match, whatever the patterns of a target say.

## Git

### REQ-GIT-01: git is started without a shell

git is started as a program with its arguments passed as a list. No shell command line is built from them.

### REQ-GIT-03: A revision range cannot be read as an option or as a path

The revision range is passed to git after `--end-of-options` and is followed by `--`.
