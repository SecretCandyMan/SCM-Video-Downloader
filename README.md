# Video Downloader Userscript

A Tampermonkey userscript that adds download buttons next to video links on web pages and provides a bulk download option.

## Features

- Automatically detects video links on web pages
- Adds download buttons next to each video link
- Bulk download option via a floating button
- Download progress notifications
- Configurable allowed domains
- Supports dynamic content loading

## Supported Video Formats

- .webm
- .mp4
- .m4v
- .mov
- .avi
- .wmv
- .flv
- .mkv

## Installation

1. Install the Tampermonkey browser extension
2. Create a new userscript in Tampermonkey
3. Copy and paste the contents of `scm-video-downloader.user.js` into the editor
4. Save the script

## Configuration

### Allowed Domains

To configure which domains the script works on, edit the `allowedDomains` array at the top of the script:

```javascript
const allowedDomains = ['*']; // Allow all domains
// OR
const allowedDomains = ['example.com', 'videos.com']; // Specific domains only
```

## Usage

- Individual downloads: Click the "Download" button next to any video link
- Bulk download: Click the floating "Bulk Download" button in the bottom right corner
- Progress notifications appear when downloads start and complete
- The bulk download counter shows how many downloadable videos are found on the page

## Notes

- The script only processes direct video file links in `<a>` tags
- - Downloads are processed with a 500ms delay between each file to prevent overwhelming the browser
- The script automatically scans for new content every 2 seconds
