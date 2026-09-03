
(function() {
    'use strict';

    function initReadingProgress() {
        const progressBar = document.createElement('div');
        progressBar.className = 'reading-progress';
        document.body.appendChild(progressBar);

        function updateProgress() {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            const progress = (scrollTop / scrollHeight) * 100;
            progressBar.style.width = progress + '%';
        }

        window.addEventListener('scroll', updateProgress, { passive: true });
        updateProgress();
    }

    function enhanceCodeBlocks() {
        const codeBlocks = document.querySelectorAll('.md-typeset pre > code');
        
        codeBlocks.forEach((block) => {
            const pre = block.parentElement;
            
            if (pre.querySelector('.code-language')) return;
            
            const language = block.className.match(/language-(\w+)/);
            if (language && language[1]) {
                const langLabel = document.createElement('span');
                langLabel.className = 'code-language';
                langLabel.textContent = language[1].toUpperCase();
                langLabel.style.cssText = `
                    position: absolute;
                    top: 1rem;
                    left: 1rem;
                    background: rgba(255, 107, 53, 0.15);
                    color: #ff6b35;
                    padding: 0.35rem 0.85rem;
                    border-radius: 4px;
                    font-size: 0.75rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    font-family: 'Inter', sans-serif;
                    border: 1px solid rgba(255, 107, 53, 0.25);
                `;
                pre.style.position = 'relative';
                pre.appendChild(langLabel);
            }
        });
    }

    function addArticleMeta() {
        // Disabled by preference: remove injected "Last updated / min read" meta.
    }

    function estimateReadingTime() {
        const text = document.querySelector('.md-content__inner')?.textContent || '';
        const words = text.trim().split(/\s+/).length;
        const readingTime = Math.ceil(words / 250);
        return readingTime;
    }

    function smoothScrollToAnchors() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                const targetId = this.getAttribute('href');
                if (targetId === '#') return;
                
                const target = document.querySelector(targetId);
                if (target) {
                    e.preventDefault();
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                    
                    window.history.pushState(null, '', targetId);
                }
            });
        });
    }

    function addCopyButtonToCodeBlocks() {
        const codeBlocks = document.querySelectorAll('.md-typeset pre > code');
        
        codeBlocks.forEach((block) => {
            const pre = block.parentElement;
            
            if (pre.querySelector('.copy-code-button')) return;
            
            const button = document.createElement('button');
            button.className = 'copy-code-button';
            button.setAttribute('aria-label', 'Copy code');
            button.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
            `;
            button.style.cssText = `
                position: absolute;
                top: 1rem;
                right: 1rem;
                background: rgba(255, 255, 255, 0.15);
                border: 1px solid rgba(255, 255, 255, 0.2);
                color: #e2e8f0;
                padding: 0.65rem;
                border-radius: 6px;
                cursor: pointer;
                opacity: 0;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10;
            `;
            
            pre.addEventListener('mouseenter', () => {
                button.style.opacity = '1';
            });
            
            pre.addEventListener('mouseleave', () => {
                if (!button.classList.contains('copied')) {
                    button.style.opacity = '0';
                }
            });
            
            button.addEventListener('mouseenter', () => {
                button.style.background = 'rgba(255, 107, 53, 0.4)';
                button.style.borderColor = 'rgba(255, 107, 53, 0.5)';
            });
            
            button.addEventListener('mouseleave', () => {
                if (!button.classList.contains('copied')) {
                    button.style.background = 'rgba(255, 255, 255, 0.15)';
                    button.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                }
            });
            
            button.addEventListener('click', async () => {
                const code = block.textContent;
                
                try {
                    await navigator.clipboard.writeText(code);
                    button.classList.add('copied');
                    button.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    `;
                    button.style.background = 'rgba(46, 125, 50, 0.5)';
                    button.style.borderColor = 'rgba(46, 125, 50, 0.6)';
                    button.style.opacity = '1';
                    
                    setTimeout(() => {
                        button.classList.remove('copied');
                        button.innerHTML = `
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                        `;
                        button.style.background = 'rgba(255, 255, 255, 0.15)';
                        button.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                        button.style.opacity = '0';
                    }, 2500);
                } catch (err) {
                    console.error('Failed to copy code:', err);
                }
            });
            
            pre.style.position = 'relative';
            pre.appendChild(button);
        });
    }

    function addHeadingAnchors() {
        const headings = document.querySelectorAll('.md-content h2, .md-content h3, .md-content h4');
        
        headings.forEach((heading) => {
            if (heading.querySelector('.heading-anchor') || !heading.id) return;
            
            const anchor = document.createElement('a');
            anchor.className = 'heading-anchor';
            anchor.href = '#' + heading.id;
            anchor.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg>
            `;
            anchor.style.cssText = `
                color: #cbd5e0;
                text-decoration: none;
                margin-left: 0.75rem;
                opacity: 0;
                transition: all 0.2s ease;
                display: inline-flex;
                align-items: center;
                vertical-align: middle;
            `;
            
            heading.style.display = 'flex';
            heading.style.alignItems = 'center';
            
            heading.addEventListener('mouseenter', () => {
                anchor.style.opacity = '0.6';
            });
            heading.addEventListener('mouseleave', () => {
                anchor.style.opacity = '0';
            });
            
            anchor.addEventListener('mouseenter', () => {
                anchor.style.opacity = '1';
                anchor.style.color = '#ff6b35';
            });
            
            anchor.addEventListener('mouseleave', () => {
                anchor.style.color = '#cbd5e0';
            });
            
            heading.appendChild(anchor);
        });
    }

    function enhanceExternalLinks() {
        const links = document.querySelectorAll('.md-content a[href^="http"]');
        
        links.forEach((link) => {
            if (!link.querySelector('.external-icon') && !link.classList.contains('md-button')) {
                const icon = document.createElement('svg');
                icon.classList.add('external-icon');
                icon.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                icon.setAttribute('width', '14');
                icon.setAttribute('height', '14');
                icon.setAttribute('viewBox', '0 0 24 24');
                icon.setAttribute('fill', 'none');
                icon.setAttribute('stroke', 'currentColor');
                icon.setAttribute('stroke-width', '2');
                icon.setAttribute('stroke-linecap', 'round');
                icon.setAttribute('stroke-linejoin', 'round');
                icon.innerHTML = '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line>';
                icon.style.cssText = `
                    display: inline-block;
                    margin-left: 0.35em;
                    opacity: 0.5;
                    vertical-align: middle;
                    transition: opacity 0.2s ease;
                `;
                
                link.addEventListener('mouseenter', () => {
                    icon.style.opacity = '0.8';
                });
                
                link.addEventListener('mouseleave', () => {
                    icon.style.opacity = '0.5';
                });
                
                link.appendChild(icon);
            }
            
            if (!link.hasAttribute('target')) {
                link.setAttribute('target', '_blank');
                link.setAttribute('rel', 'noopener noreferrer');
            }
        });
    }
    
    function addScrollAnimations() {
        // Disabled by preference: no motion-on-scroll effects.
    }

    function addTableOfContentsHighlight() {
        const tocLinks = document.querySelectorAll('.md-nav--secondary a');
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const id = entry.target.getAttribute('id');
                    tocLinks.forEach((link) => {
                        link.classList.remove('active');
                        if (link.getAttribute('href') === '#' + id) {
                            link.classList.add('active');
                        }
                    });
                }
            });
        }, {
            rootMargin: '-20% 0px -70% 0px'
        });
        
        document.querySelectorAll('h2[id], h3[id]').forEach((heading) => {
            observer.observe(heading);
        });
    }

    function lazyLoadImages() {
        const images = document.querySelectorAll('img[data-src]');
        if (!images.length) return;

        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    imageObserver.unobserve(img);
                }
            });
        });

        images.forEach((img) => imageObserver.observe(img));
    }

    function addBreadcrumbs() {
        const header = document.querySelector('.md-content__inner h1');
        if (!header || document.querySelector('.custom-breadcrumbs')) return;

        const breadcrumbs = document.createElement('nav');
        breadcrumbs.className = 'custom-breadcrumbs';
        breadcrumbs.innerHTML = '<a href="/">Home</a>';
        header.insertAdjacentElement('beforebegin', breadcrumbs);
    }

    function addRisingStackElements() {
        // Keep as safe no-op hook for future theme enhancements.
    }

    function init() {
        initReadingProgress();
        enhanceCodeBlocks();
        document.querySelectorAll('.article-meta').forEach((el) => el.remove());
        smoothScrollToAnchors();
        addCopyButtonToCodeBlocks();
        addHeadingAnchors();
        enhanceExternalLinks();
        addTableOfContentsHighlight();
        lazyLoadImages();
        addRisingStackElements();
        addBreadcrumbs();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    const observer = new MutationObserver(() => {
        enhanceCodeBlocks();
        addCopyButtonToCodeBlocks();
        enhanceExternalLinks();
        document.querySelectorAll('.article-meta').forEach((el) => el.remove());
        addRisingStackElements();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    document.addEventListener('turbo:load', init);
    document.addEventListener('turbo:render', init);
})();
