// ==UserScript==
// @name         SCM Video Downloader
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Download video files from specified websites with bulk download option
// @updateURL    https://github.com/SecretCandyMan/SCM-Video-Downloader/raw/refs/heads/main/scm-video-downloader.user.js
// @downloadURL  https://github.com/SecretCandyMan/SCM-Video-Downloader/raw/refs/heads/main/scm-video-downloader.user.js
// @author       SecretCandyMan
// @match        *://*/*
// @grant        GM_download
// @grant        GM_notification
// ==/UserScript==

(function() {
    'use strict';

    // Configure allowed domains here
    // Use ['*'] to allow all domains, or specify domains like ['example.com', 'site.com']
    const allowedDomains = ['*'];

    // Styles for the UI elements
    const style = document.createElement('style');
    style.textContent = `
        .media-dl-btn {
            background: #4CAF50;
            color: white;
            border: none;
            padding: 5px 10px;
            border-radius: 4px;
            cursor: pointer;
            margin: 5px;
            font-size: 12px;
        }
        .media-dl-btn:hover {
            background: #45a049;
        }
        .bulk-dl-btn {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #2196F3;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            z-index: 10000;
            display: none;
        }
        .bulk-dl-btn:hover {
            background: #1976D2;
        }
        .bulk-dl-btn.visible {
            display: block;
        }
        .download-counter {
            background: #ff5722;
            color: white;
            border-radius: 50%;
            padding: 2px 6px;
            font-size: 12px;
            margin-left: 5px;
        }
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 15px 20px;
            border-radius: 4px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            z-index: 10002;
            animation: slideIn 0.3s ease-out;
        }
        @keyframes slideIn {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
        }
    `;
    document.head.appendChild(style);

    // Download tracking
    let activeDownloads = 0;
    let totalDownloads = 0;

    // Function to show notification
    function showNotification(message) {
        if (typeof GM_notification !== 'undefined') {
            GM_notification({
                text: message,
                title: 'Video Downloader',
                timeout: 5000
            });
        } else {
            const notification = document.createElement('div');
            notification.className = 'notification';
            notification.textContent = message;
            document.body.appendChild(notification);

            setTimeout(() => {
                notification.style.opacity = '0';
                notification.style.transition = 'opacity 0.3s ease-out';
                setTimeout(() => notification.remove(), 300);
            }, 5000);
        }
    }

    // Function to check if a URL is a video file
    function isVideoURL(url) {
        const videoExtensions = [
            '.webm', '.mp4', '.m4v', '.mov', '.avi', '.wmv', '.flv', '.mkv'
        ];
        return videoExtensions.some(ext => url.toLowerCase().endsWith(ext));
    }

    // Function to check if current domain is allowed
    function isDomainAllowed() {
        if (allowedDomains.includes('*')) return true;
        const currentDomain = window.location.hostname;
        return allowedDomains.some(domain =>
            currentDomain === domain ||
            currentDomain.endsWith('.' + domain)
        );
    }

    // Function to get a clean filename from URL
    function getFilenameFromURL(url) {
        const urlParts = url.split('/');
        const filename = urlParts[urlParts.length - 1];
        return decodeURIComponent(filename);
    }

    // Function to track download completion
    function trackDownload(success) {
        activeDownloads--;
        if (activeDownloads === 0) {
            const message = success ?
                `All ${totalDownloads} videos downloaded successfully!` :
                'Download completed with some errors';
            showNotification(message);
        }
    }

    // Function to download a single video file
    function downloadVideo(url) {
        const filename = getFilenameFromURL(url);
        activeDownloads++;

        if (typeof GM_download !== 'undefined') {
            GM_download({
                url: url,
                name: filename,
                saveAs: false,
                onload: () => trackDownload(true),
                onerror: () => trackDownload(false)
            });
        } else {
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            trackDownload(true);
        }
    }

    // Create bulk download button
    const bulkButton = document.createElement('button');
    bulkButton.className = 'bulk-dl-btn';
    bulkButton.innerHTML = 'Bulk Download <span class="download-counter">0</span>';
    document.body.appendChild(bulkButton);

    // Function to update video counter
    function updateVideoCounter() {
        const videoUrls = new Set();

        // Only collect video URLs from links (excluding fileThumb class)
        document.querySelectorAll('a:not(.fileThumb)').forEach(link => {
            if (isVideoURL(link.href)) {
                videoUrls.add(link.href);
            }
        });

        const counter = bulkButton.querySelector('.download-counter');
        counter.textContent = videoUrls.size;
        bulkButton.classList.toggle('visible', videoUrls.size > 0);

        return videoUrls;
    }

    // Function to add download button next to video links
    function addDownloadButton(link) {
        if (link.classList.contains('fileThumb')) {
            return; // Skip fileThumb links
        }

        if (link.parentNode.querySelector('.media-dl-btn')) {
            return; // Button already exists
        }

        if (!isVideoURL(link.href)) {
            return;
        }

        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'media-dl-btn';
        downloadBtn.textContent = '⬇️ Download';
        downloadBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            totalDownloads = 1;
            downloadVideo(link.href);
        };

        link.parentNode.insertBefore(downloadBtn, link.nextSibling);
    }

    // Function to scan page for video links
    function scanForVideos() {
        if (!isDomainAllowed()) {
            bulkButton.style.display = 'none';
            return;
        }

        // Only scan for video links in <a> tags
        document.querySelectorAll('a').forEach(addDownloadButton);

        // Update the bulk download counter
        updateVideoCounter();
    }

    // Handle bulk download
    bulkButton.onclick = () => {
        const videoUrls = updateVideoCounter();
        if (videoUrls.size === 0) return;

        totalDownloads = videoUrls.size;
        showNotification(`Starting download of ${totalDownloads} videos...`);

        // Add small delay between downloads to prevent overwhelming the browser
        let delay = 0;
        videoUrls.forEach(url => {
            setTimeout(() => downloadVideo(url), delay);
            delay += 500; // 500ms delay between each download
        });
    };

    // Scan for videos when page loads
    scanForVideos();

    // Scan for videos periodically (for dynamically loaded content)
    setInterval(scanForVideos, 2000);

    // Add menu command to manually trigger scan
    if (typeof GM_registerMenuCommand !== 'undefined') {
        GM_registerMenuCommand('Scan for downloadable videos', scanForVideos);
    }
})();
