# Security policy

## Reporting a vulnerability

Please do **not** report a security problem in a public issue, pull request or
forum post.

Report it privately through GitHub instead: open the **Security** tab of this
repository, then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainers for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- the log lines that help (remove tokens, passwords and addresses first).

The fix ships as a new version of the integration, and the advisory is
published once users can update.

## Supported versions

Only the latest release receives security fixes: update the integration from
Gladys before reporting a problem.

## Sensitive data handled by the integration

- The OpenPlantBook **client secret** is stored by Gladys as a `secret` field
  (never sent back to the browser). The integration only sends it to
  `https://open.plantbook.io/api/v1/token/` and never logs it, nor the access
  tokens it receives.
- The integration only talks to `open.plantbook.io` (API) and to the HTTPS
  image host the API returns for the plant photos.
- It writes only under `/data` (cached plant thresholds and photos); the
  container root filesystem is read-only.

## Scope

In scope: the code of this repository and the Docker image it publishes.

Out of scope: Gladys Assistant itself (see its
[security policy](https://github.com/GladysAssistant/Gladys/security/policy)),
and the Open Plantbook service (report problems of the service to its
maintainers at https://open.plantbook.io/).
