# Traceframe

**A quieter way to inspect where an image came from.**

Traceframe reads Content Credentials and image metadata in your browser. It can report a verified AI-generation claim, unverified AI-tool tags, or camera details saved in the file. Missing tags do not prove an image is real.

> Traceframe is an experimental provenance viewer, not a universal AI-image detector or forensic verification service.

## What it does

- Reads C2PA Content Credentials locally in your browser.
- Highlights an AI-generation claim when the image’s credential records one.
- Checks EXIF, XMP, IPTC, and PNG text metadata for AI-tool tags and camera details.
- Reports missing, invalid, and unreadable credentials as distinct outcomes.
- Shows basic file information and optional exploratory image maps.
- Keeps the selected image on your device; there is no image-upload endpoint.

## Try it locally

Requirements: Node.js 22.12 or newer.

```sh
git clone https://github.com/Yuvraj-Arora-606/traceframe.git
cd traceframe
npm ci
npm run dev
```

Vite prints a local URL, usually `http://localhost:5173`.

## Verify a change

```sh
npm test
npm run build
npm run test:phase0
```

The Playwright smoke check uses Chrome and writes its screenshot and report under the ignored `artifacts/` directory. You can set `CHROME_PATH`, `BASE_URL`, `PROFILE_DIR`, or `MOBILE=1`. To check a local reference image, set `IMAGE_PATH`; optionally set `IMAGE_PROVENANCE=ai-generated` or `IMAGE_PROVENANCE=camera-photo` to assert the expected result.

## Read the result

| Result | Meaning |
| --- | --- |
| **AI origin recorded** | A readable Content Credential declares AI generation. Review the credential’s signer and history before relying on it. |
| **AI-tool tags found** | File metadata mentions a known generator or generation field. Metadata is editable and does not verify who created the image. |
| **Camera details found** | File metadata includes camera-related details. These can be edited or removed and do not prove the image is an untouched camera photo. |
| **No AI label found** | No AI-generation credential or recognized metadata tag was found. The image may still be AI-made. |
| **Credential failed validation** | A credential was present, but its integrity check reported a problem. |
| **Origin check unavailable** | The browser could not read the image records. |

Credentials can be absent, stripped, or incomplete. Even a recorded claim needs context; Traceframe does not determine whether an image depicts a true event.

## Privacy and architecture

The app is a static Vite site. Credential parsing, metadata inspection, and image maps run in the browser. Traceframe has no accounts, analytics, cookies, database, backend, or image-upload API. The visual classifier was removed after it failed to distinguish the supplied known-AI and camera examples reliably; **there is no AI-likelihood score**. Metadata clues are separate from verified credentials and can be missing or edited.

## Deploy with Vercel

Import this repository in Vercel. The included `vercel.json` sets the Vite framework, installs with `npm ci`, builds with `npm run build`, and publishes `dist/`. No environment variables are required.

## Built with

- [Vite](https://vite.dev/)
- [`@contentauth/c2pa-web`](https://github.com/contentauth/c2pa-web) (MIT)
- [`exifreader`](https://github.com/mattiasw/ExifReader) (MPL-2.0)
- [Playwright](https://playwright.dev/) and [Vitest](https://vitest.dev/) for checks

See [the validation notes](docs/model-validation.md) for detector evaluation and [third-party notices](docs/third-party-notices.md) for attribution.
