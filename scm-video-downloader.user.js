// ==UserScript==
// @name         Enhanced SCM Video Downloader
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Comprehensive video file downloader with enhanced detection for all video sources
// @author       SecretCandyMan
// @match        *://*/*
// @grant        GM_download
// @grant        GM_notification
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function() {
    'use strict';

    // Configure allowed domains here
    // Use ['*'] to allow all domains, or specify domains like ['example.com', 'site.com']
    const allowedDomains = ['4chan.org', 'tumblr.com', '*.tumblr.com'];

    // Comprehensive video file extensions
    const videoExtensions = [
        '.webm', '.mp4', '.m4v', '.mov', '.avi', '.wmv', '.flv', '.mkv',
        '.ogv', '.3gp', '.3g2', '.asf', '.f4v', '.m2v', '.m4p', '.mpg',
        '.mpeg', '.mpe', '.mpv', '.mp2', '.svi', '.mxf', '.roq', '.nsv',
        '.f4p', '.f4a', '.f4b'
    ];

    // Video MIME types for additional detection
    const videoMimeTypes = [
        'video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov',
        'video/wmv', 'video/flv', 'video/mkv', 'video/m4v', 'video/3gpp',
        'video/quicktime', 'video/x-msvideo', 'video/x-ms-wmv'
    ];

    // Styles for the UI elements
    const style = document.createElement('style');
    style.textContent = `
        .media-dl-btn {
            background: #4CAF50;
            color: white;
            border: none;
            padding: 4px 8px;
            border-radius: 3px;
            cursor: pointer;
            margin: 2px;
            font-size: 11px;
            font-family: Arial, sans-serif;
            text-decoration: none;
            display: inline-block;
            transition: background 0.2s;
        }
        .media-dl-btn:hover {
            background: #45a049;
        }
        .bulk-dl-panel {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #2196F3;
            color: white;
            border: none;
            padding: 12px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-family: Arial, sans-serif;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            display: none;
            min-width: 120px;
            text-align: center;
        }
        .bulk-dl-panel:hover {
            background: #1976D2;
        }
        .bulk-dl-panel.visible {
            display: block;
        }
        .download-counter {
            background: #ff5722;
            color: white;
            border-radius: 12px;
            padding: 2px 8px;
            font-size: 11px;
            margin-left: 8px;
            font-weight: bold;
        }
        .video-source-indicator {
            background: #9C27B0;
            color: white;
            padding: 1px 4px;
            border-radius: 2px;
            font-size: 9px;
            margin-left: 4px;
            font-weight: bold;
        }
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 15px 20px;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10002;
            animation: slideIn 0.3s ease-out;
            max-width: 300px;
            word-wrap: break-word;
        }
        .notification.error {
            background: #f44336;
        }
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        .progress-indicator {
            margin-top: 8px;
            font-size: 12px;
            opacity: 0.9;
        }
    `;
    document.head.appendChild(style);

    // Download tracking
    let activeDownloads = 0;
    let totalDownloads = 0;
    let downloadErrors = 0;
    let processedUrls = new Set();

    // Video detection and collection
    class VideoDetector {
        constructor() {
            this.foundVideos = new Map(); // URL -> {source, element, filename}
        }

        // Check if a URL is a video file
        isVideoURL(url) {
            if (!url) return false;
            const cleanUrl = url.split('?')[0].split('#')[0].toLowerCase();
            return videoExtensions.some(ext => cleanUrl.endsWith(ext));
        }

        // Check if MIME type indicates video
        isVideoMimeType(mimeType) {
            if (!mimeType) return false;
            return videoMimeTypes.some(type => mimeType.toLowerCase().includes(type));
        }

        // Extract filename from URL
        getFilenameFromURL(url) {
            try {
                const urlObj = new URL(url, window.location.href);
                const pathname = urlObj.pathname;
                let filename = pathname.split('/').pop() || 'video';
                
                // Handle query parameters - sometimes they contain the real filename
                const queryParams = new URLSearchParams(urlObj.search);
                const filenameFromQuery = this.extractFilenameFromQuery(queryParams);
                
                if (filenameFromQuery) {
                    filename = filenameFromQuery;
                } else {
                    // Remove query parameters from filename if no filename found in query
                    filename = filename.split('?')[0];
                }
                
                // Handle special cases for common video hosting patterns
                filename = this.handleSpecialFilenamePatterns(filename, url);
                
                // Ensure it has a video extension
                if (!this.isVideoURL(filename)) {
                    const detectedExt = this.detectVideoExtensionFromURL(url);
                    if (detectedExt) {
                        filename += detectedExt;
                    } else {
                        // Only add .mp4 if we can't detect the format
                        filename += '.mp4';
                    }
                }
                
                // Clean up the filename
                filename = this.sanitizeFilename(filename);
                
                return decodeURIComponent(filename);
            } catch (e) {
                // Generate a more descriptive fallback filename
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const domain = window.location.hostname.replace(/[^a-zA-Z0-9]/g, '_');
                return `video_${domain}_${timestamp}.mp4`;
            }
        }

        // Extract filename from URL query parameters
        extractFilenameFromQuery(queryParams) {
            // Common parameter names that might contain filenames
            const filenameParams = ['filename', 'file', 'name', 'title', 'video', 'media'];
            
            for (const param of filenameParams) {
                const value = queryParams.get(param);
                if (value && (this.isVideoURL(value) || value.includes('.'))) {
                    return value;
                }
            }
            
            // Check for Content-Disposition style parameters
            const disposition = queryParams.get('response-content-disposition');
            if (disposition) {
                const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                if (match && match[1]) {
                    return match[1].replace(/['"]/g, '');
                }
            }
            
            return null;
        }
        // Try to detect video extension from URL patterns
        detectVideoExtensionFromURL(url) {
            for (const ext of videoExtensions) {
                if (url.toLowerCase().includes(ext)) {
                    return ext;
                }
            }
            return null;
        }

        // Add video to collection
        addVideo(url, source, element = null) {
            if (!url || this.foundVideos.has(url)) return;
            
            try {
                const absoluteUrl = new URL(url, window.location.href).href;
                const filename = this.getFilenameFromURL(absoluteUrl);
                
                this.foundVideos.set(absoluteUrl, {
                    source,
                    element,
                    filename,
                    detected: Date.now()
                });
            } catch (e) {
                console.warn('Failed to process video URL:', url, e);
            }
        }

        // Scan for video elements
        scanVideoElements() {
            document.querySelectorAll('video').forEach(video => {
                // Check video src
                if (video.src) {
                    this.addVideo(video.src, 'video-element', video);
                }

                // Check source elements
                video.querySelectorAll('source').forEach(source => {
                    if (source.src) {
                        this.addVideo(source.src, 'source-element', source);
                    }
                });
            });
        }

        // Scan for video links
        scanVideoLinks() {
            document.querySelectorAll('a[href]').forEach(link => {
                if (this.isVideoURL(link.href)) {
                    this.addVideo(link.href, 'link', link);
                }
            });
        }

        // Scan for video URLs in various attributes
        scanVideoAttributes() {
            const videoAttributes = ['data-src', 'data-video', 'data-url', 'data-file'];
            const selectors = videoAttributes.map(attr => `[${attr}]`).join(',');
            
            document.querySelectorAll(selectors).forEach(element => {
                videoAttributes.forEach(attr => {
                    const url = element.getAttribute(attr);
                    if (url && this.isVideoURL(url)) {
                        this.addVideo(url, `${attr}-attribute`, element);
                    }
                });
            });
        }

        // Scan for video URLs in text content and comments
        scanTextContent() {
            const walker = document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT,
                null,
                false
            );

            let node;
            const urlPattern = /https?:\/\/[^\s<>"']+/g;
            
            while (node = walker.nextNode()) {
                const text = node.nodeValue || '';
                const urls = text.match(urlPattern) || [];
                
                urls.forEach(url => {
                    if (this.isVideoURL(url)) {
                        this.addVideo(url, 'text-content', node.parentElement);
                    }
                });
            }
        }

        // Comprehensive scan
        scanAll() {
            this.foundVideos.clear();
            
            try {
                this.scanVideoElements();
                this.scanVideoLinks();
                this.scanVideoAttributes();
                this.scanTextContent();
            } catch (e) {
                console.error('Error during video scan:', e);
            }

            return this.foundVideos;
        }

        // Get all found video URLs
        getAllVideoUrls() {
            return Array.from(this.foundVideos.keys());
        }

        // Get video count
        getVideoCount() {
            return this.foundVideos.size;
        }
    }

    // Initialize video detector
    const videoDetector = new VideoDetector();

    // Enhanced notification system
    function showNotification(message, type = 'success') {
        if (typeof GM_notification !== 'undefined') {
            GM_notification({
                text: message,
                title: 'Enhanced Video Downloader',
                timeout: 6000
            });
        } else {
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            notification.innerHTML = message;
            document.body.appendChild(notification);

            setTimeout(() => {
                notification.style.opacity = '0';
                notification.style.transition = 'opacity 0.3s ease-out';
                setTimeout(() => notification.remove(), 300);
            }, 6000);
        }
    }

    // Enhanced domain checking
    function isDomainAllowed() {
        if (allowedDomains.includes('*')) return true;
        
        const currentDomain = window.location.hostname;
        return allowedDomains.some(domain => {
            if (domain.startsWith('*.')) {
                const baseDomain = domain.substring(2);
                return currentDomain === baseDomain || currentDomain.endsWith('.' + baseDomain);
            }
            return currentDomain === domain || currentDomain.endsWith('.' + domain);
        });
    }

    // Enhanced download function with better error handling
    function downloadVideo(url, filename) {
        activeDownloads++;
        processedUrls.add(url);

        if (typeof GM_download !== 'undefined') {
            GM_download({
                url: url,
                name: filename,
                saveAs: false,
                onload: () => {
                    activeDownloads--;
                    checkDownloadCompletion();
                },
                onerror: (error) => {
                    activeDownloads--;
                    downloadErrors++;
                    console.error('Download failed:', url, error);
                    checkDownloadCompletion();
                }
            });
        } else {
            // Fallback for browsers without GM_download
            try {
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                
                setTimeout(() => {
                    activeDownloads--;
                    checkDownloadCompletion();
                }, 1000);
            } catch (e) {
                activeDownloads--;
                downloadErrors++;
                checkDownloadCompletion();
            }
        }
    }

    // Check if all downloads are complete
    function checkDownloadCompletion() {
        if (activeDownloads === 0 && totalDownloads > 0) {
            const successCount = totalDownloads - downloadErrors;
            let message;
            
            if (downloadErrors === 0) {
                message = `✅ All ${totalDownloads} videos downloaded successfully!`;
            } else if (successCount > 0) {
                message = `⚠️ ${successCount}/${totalDownloads} videos downloaded successfully. ${downloadErrors} failed.`;
            } else {
                message = `❌ All downloads failed. Check console for details.`;
            }
            
            showNotification(message, downloadErrors > 0 ? 'error' : 'success');
            
            // Reset counters
            totalDownloads = 0;
            downloadErrors = 0;
        }
    }

    // Create and setup bulk download panel
    const bulkPanel = document.createElement('div');
    bulkPanel.className = 'bulk-dl-panel';
    bulkPanel.innerHTML = `
        <div>📥 Bulk Download</div>
        <div class="download-counter">0</div>
        <div class="progress-indicator" style="display: none;">Downloading...</div>
    `;
    document.body.appendChild(bulkPanel);

    // Add individual download buttons
    function addDownloadButton(element, url, source) {
        // Skip if button already exists
        if (element.parentNode && element.parentNode.querySelector('.media-dl-btn')) {
            return;
        }

        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'media-dl-btn';
        downloadBtn.innerHTML = `⬇️ DL<span class="video-source-indicator">${source.split('-')[0].toUpperCase()}</span>`;
        downloadBtn.title = `Download video from ${source}`;
        
        downloadBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const videoInfo = videoDetector.foundVideos.get(url);
            if (videoInfo) {
                totalDownloads = 1;
                downloadErrors = 0;
                downloadVideo(url, videoInfo.filename);
                showNotification(`📥 Starting download: ${videoInfo.filename}`);
            }
        };

        // Try to insert button near the element
        try {
            if (element.parentNode) {
                element.parentNode.insertBefore(downloadBtn, element.nextSibling);
            } else {
                document.body.appendChild(downloadBtn);
            }
        } catch (e) {
            console.warn('Could not add download button:', e);
        }
    }

    // Update video counter and add buttons
    function updateVideoDisplay() {
        if (!isDomainAllowed()) {
            bulkPanel.style.display = 'none';
            return;
        }

        const videos = videoDetector.scanAll();
        const videoCount = videoDetector.getVideoCount();
        
        // Update counter
        const counter = bulkPanel.querySelector('.download-counter');
        counter.textContent = videoCount;
        bulkPanel.classList.toggle('visible', videoCount > 0);

        // Add individual download buttons
        videos.forEach((videoInfo, url) => {
            if (videoInfo.element && videoInfo.element.parentNode) {
                addDownloadButton(videoInfo.element, url, videoInfo.source);
            }
        });

        return videos;
    }

    // Handle bulk download
    bulkPanel.onclick = () => {
        const videos = videoDetector.scanAll();
        const videoUrls = videoDetector.getAllVideoUrls();
        
        if (videoUrls.length === 0) {
            showNotification('❌ No videos found to download', 'error');
            return;
        }

        totalDownloads = videoUrls.length;
        downloadErrors = 0;
        processedUrls.clear();

        showNotification(`📥 Starting bulk download of ${totalDownloads} videos...`);
        
        // Show progress indicator
        const progressIndicator = bulkPanel.querySelector('.progress-indicator');
        progressIndicator.style.display = 'block';

        // Start downloads with delays to prevent overwhelming
        videoUrls.forEach((url, index) => {
            const videoInfo = videos.get(url);
            setTimeout(() => {
                if (videoInfo) {
                    downloadVideo(url, videoInfo.filename);
                }
            }, index * 300); // 300ms delay between downloads
        });

        // Hide progress indicator after a delay
        setTimeout(() => {
            progressIndicator.style.display = 'none';
        }, videoUrls.length * 300 + 5000);
    };

    // Initial scan
    function performInitialScan() {
        if (isDomainAllowed()) {
            updateVideoDisplay();
            console.log(`Enhanced Video Downloader: Found ${videoDetector.getVideoCount()} videos on ${window.location.hostname}`);
        }
    }

    // Enhanced periodic scanning for dynamic content
    let scanInterval;
    function startPeriodicScanning() {
        if (scanInterval) clearInterval(scanInterval);
        
        scanInterval = setInterval(() => {
            if (document.hidden) return; // Skip when tab is not visible
            updateVideoDisplay();
        }, 3000);
    }

    // Stop scanning when tab becomes hidden
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (scanInterval) {
                clearInterval(scanInterval);
                scanInterval = null;
            }
        } else {
            startPeriodicScanning();
        }
    });

    // Initialize when page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(performInitialScan, 1000);
            startPeriodicScanning();
        });
    } else {
        setTimeout(performInitialScan, 1000);
        startPeriodicScanning();
    }

    // Enhanced menu commands
    if (typeof GM_registerMenuCommand !== 'undefined') {
        GM_registerMenuCommand('🔍 Scan for videos', () => {
            updateVideoDisplay();
            showNotification(`Found ${videoDetector.getVideoCount()} videos`);
        });
        
        GM_registerMenuCommand('📥 Download all videos', () => {
            bulkPanel.click();
        });

        GM_registerMenuCommand('📋 List found videos', () => {
            const videos = videoDetector.scanAll();
            console.group('Found Videos:');
            videos.forEach((info, url) => {
                console.log(`${info.filename} (${info.source})`, url);
            });
            console.groupEnd();
            showNotification(`Check console for ${videos.size} video URLs`);
        });
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (scanInterval) clearInterval(scanInterval);
    });

    console.log('Enhanced SCM Video Downloader loaded successfully');
})();
