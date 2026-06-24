// Sea Hampton House — Interactive Features

document.addEventListener('DOMContentLoaded', function() {
    
    // Smooth scroll for navigation
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Navbar background on scroll
    const navbar = document.querySelector('.navbar');
    let lastScroll = 0;

    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        
        if (currentScroll > 100) {
            navbar.style.background = 'rgba(26, 58, 82, 0.98)';
            navbar.style.boxShadow = '0 2px 20px rgba(0,0,0,0.2)';
        } else {
            navbar.style.background = 'rgba(26, 58, 82, 0.95)';
            navbar.style.boxShadow = 'none';
        }
        
        lastScroll = currentScroll;
    });

    // Form submission handler
    const form = document.getElementById('showing-form');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();

            const formData = new FormData(form);
            const data = Object.fromEntries(formData);

            // Show success message immediately
            const successDiv = document.createElement('div');
            successDiv.className = 'form-success';
            successDiv.innerHTML = `
                <h3>Thank You!</h3>
                <p>We've received your request and will contact you within 24 hours to schedule your showing.</p>
            `;

            form.parentElement.appendChild(successDiv);
            form.style.display = 'none';
            successDiv.style.display = 'block';

            // Send to relay backend via tunnel
            fetch('https://inbox.31harbor.com/api/contact/31harbor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            }).catch(function(err) {
                console.log('Form send error (non-blocking):', err);
            });

            console.log('Showing request:', data);
        });
    }

    // Gallery lightbox (simple implementation)
    const galleryItems = document.querySelectorAll('.gallery-item img');
    galleryItems.forEach(img => {
        img.addEventListener('click', function() {
            // Could implement full lightbox here
            console.log('Gallery image clicked:', this.alt);
        });
    });

    // Animate features on scroll
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    // Observe feature cards
    document.querySelectorAll('.feature-card').forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        card.style.transition = 'opacity 0.6s, transform 0.6s';
        observer.observe(card);
    });

    // Parallax effect for hero
    const hero = document.querySelector('.hero');
    if (hero) {
        window.addEventListener('scroll', () => {
            const scrolled = window.pageYOffset;
            const heroContent = hero.querySelector('.hero-content');
            if (heroContent && scrolled < 600) {
                heroContent.style.transform = `translateY(${scrolled * 0.3}px)`;
                heroContent.style.opacity = 1 - (scrolled / 600);
            }
        });
    }

    // Mobile menu toggle (if implemented)
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');
    
    if (mobileMenuBtn && navLinks) {
        mobileMenuBtn.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });
    }

    // Count-up animation for stats
    function animateValue(element, start, end, duration) {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const value = Math.floor(progress * (end - start) + start);
            element.textContent = value.toLocaleString();
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }

    // Trigger stats animation when visible
    const statsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const numbers = entry.target.querySelectorAll('.feature-number');
                numbers.forEach(num => {
                    const text = num.textContent;
                    const numericValue = parseFloat(text.replace(/[^0-9.]/g, ''));
                    if (!isNaN(numericValue)) {
                        animateValue(num, 0, numericValue, 2000);
                        statsObserver.unobserve(entry.target);
                    }
                });
            }
        });
    }, { threshold: 0.5 });

    const featuresBar = document.querySelector('.features-bar');
    if (featuresBar) {
        statsObserver.observe(featuresBar);
    }

    console.log('Sea Hampton House website loaded');
});
