# Privacy

MACHINE VISION / AFL LAB is a local-only video processing tool from Armstrong Future Labs.

## Video data

- A selected video is opened through a temporary browser `blob:` URL.
- Frames are analysed with browser canvas APIs in device memory.
- Composite exports are recorded in the browser and downloaded directly to the device.
- There is no upload endpoint, application server, database or cloud media storage.
- Temporary object URLs are revoked when a video is replaced or the app is closed, and disappear when the page is refreshed.

## Local settings

The current visual configuration and preset name are stored in the browser's `localStorage` so the interface can restore them on the same device. Video files, video frames and exports are not stored there. These settings can be removed by clearing the site's browser data.

## Network and hosting

The production application loads its own static HTML, JavaScript, CSS, bundled fonts and preview image. It does not load third-party fonts or analytics and does not make application API requests. A restrictive Content Security Policy blocks outbound connections from the application.

As with any hosted website, the hosting platform receives ordinary HTTP request metadata required to serve the page, such as IP address, user agent, requested path and request time. This metadata does not include the selected video, analysed frames or exported clip.

## External links

The interface does not link out to other sites. Fonts ship with the application.
