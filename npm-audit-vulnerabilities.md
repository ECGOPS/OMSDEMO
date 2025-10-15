# NPM Audit Vulnerabilities Report

| Package                | Severity  | Type/Description                                 | Fix Available?                | Notes/Upgrade Path                        |
|------------------------|-----------|--------------------------------------------------|-------------------------------|-------------------------------------------|
| bin-build              | High      | ReDoS, unsafe dependency chain                   | Yes (vite-plugin-imagemin 0.4.0, breaking) | Indirect via image processing            |
| bin-check              | High      | ReDoS, unsafe dependency chain                   | Yes (vite-plugin-imagemin 0.4.0, breaking) | Indirect via image processing            |
| bin-version            | High      | ReDoS                                            | Yes (vite-plugin-imagemin 0.4.0, breaking) | Indirect via image processing            |
| bin-version-check      | High      | ReDoS                                            | Yes (vite-plugin-imagemin 0.4.0, breaking) | Indirect via image processing            |
| bin-wrapper            | High      | ReDoS, unsafe dependency chain                   | Yes (vite-plugin-imagemin 0.4.0, breaking) | Indirect via image processing            |
| cacheable-request      | High      | ReDoS                                            | Yes (vite-plugin-imagemin 0.4.0, breaking) | Indirect via network/download            |
| cross-spawn            | High      | ReDoS                                            | Yes (vite-plugin-imagemin 0.4.0, breaking) | Indirect via build tools                 |
| cwebp-bin              | High      | ReDoS, unsafe dependency chain                   | Yes                           | Indirect via image processing            |
| dompurify              | Moderate  | XSS                                              | Yes (jspdf 3.0.1, breaking)   | Indirect via PDF generation              |
| download               | Moderate  | ReDoS                                            | Yes (vite-plugin-imagemin 0.4.0, breaking) | Indirect via network/download            |
| esbuild                | Moderate  | Server request hijack                            | Yes (vite 7.0.5, breaking)    | Indirect via build tools                 |
| exec-buffer            | High      | ReDoS                                            | Yes                           | Indirect via build tools                 |
| execa                  | High      | ReDoS                                            | Yes (vite-plugin-imagemin 0.4.0, breaking) | Indirect via build tools                 |
| find-versions          | High      | ReDoS                                            | Yes (vite-plugin-imagemin 0.4.0, breaking) | Indirect via build tools                 |
| gifsicle               | High      | ReDoS, unsafe dependency chain                   | Yes (vite-plugin-imagemin 0.4.0, breaking) | Indirect via image processing            |
| got                    | High      | Unsafe redirect                                  | Yes (vite-plugin-imagemin 0.4.0, breaking) | Indirect via network/download            |
| http-cache-semantics   | High      | ReDoS                                            | Yes (vite-plugin-imagemin 0.4.0, breaking) | Indirect via network/download            |
| imagemin-gifsicle      | High      | ReDoS                                            | Yes (vite-plugin-imagemin 0.4.0, breaking) | Indirect via image processing            |
| imagemin-jpegtran      | High      | ReDoS                                            | Yes (vite-plugin-imagemin 0.4.0, breaking) | Indirect via image processing            |
| imagemin-mozjpeg       | High      | ReDoS                                            | Yes                           | Indirect via image processing            |
| imagemin-optipng       | High      | ReDoS                                            | Yes                           | Indirect via image processing            |
| imagemin-pngquant      | High      | ReDoS                                            | Yes                           | Indirect via image processing            |
| imagemin-webp          | High      | ReDoS                                            | Yes                           | Indirect via image processing            |
| jpegtran-bin           | High      | ReDoS, unsafe dependency chain                   | Yes (vite-plugin-imagemin 0.4.0, breaking) | Indirect via image processing            |
| jspdf                  | High      | ReDoS, XSS                                       | Yes (3.0.1, breaking)         | Direct dependency                        |
| meow                   | High      | Uncontrolled resource consumption                | Yes                           | Indirect via CLI tools                   |
| mozjpeg                | High      | ReDoS, unsafe dependency chain                   | Yes                           | Indirect via image processing            |
| optipng-bin            | High      | ReDoS, unsafe dependency chain                   | Yes                           | Indirect via image processing            |
| pngquant-bin           | High      | ReDoS, unsafe dependency chain                   | Yes                           | Indirect via image processing            |
| semver-regex           | High      | ReDoS                                            | Yes (vite-plugin-imagemin 0.4.0, breaking) | Indirect via build tools                 |
| trim-newlines          | High      | Uncontrolled resource consumption                | Yes                           | Indirect via CLI tools                   |
| vite                   | Moderate  | Server request hijack                            | Yes (7.0.5, breaking)         | Direct dependency                        |
| vite-plugin-imagemin   | High      | ReDoS, unsafe dependency chain                   | Yes (0.4.0, breaking)         | Direct dependency                        |
| xlsx                   | High      | Prototype Pollution, ReDoS                       | No                            | Direct dependency, no fix available      | 