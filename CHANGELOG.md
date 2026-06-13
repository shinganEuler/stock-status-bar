# Changelog

## 0.1.9

- Share quote refresh results across VS Code windows to reduce duplicate data-source requests.

## 0.1.8

- Show the last US after-hours price during the unsupported overnight session when Sina returns extended-session data.
- Preserve cached US after-hours quotes during the overnight session when the live response only has the regular-session price.

## 0.1.5

- Add A/HK/US status bar market filter buttons.
- Keep market filter buttons grouped with quote items near the right side of the left status bar.
- Fix US quote refresh when VS Code injects an HTTP proxy that causes Sina quote requests to return 403.
- Add VS Code F5 extension-host debugging configuration.

## 0.1.4

- Initial Marketplace release.
- Add status bar quote display for A shares, Hong Kong stocks, US stocks, China futures, and overseas futures.
- Add commands for refresh, add stock, remove stock, and toggle quote direction icons.
- Add configurable refresh interval, status bar pagination, label template, and quote colors.
- Add README data-source notice and investment-risk disclaimer.
