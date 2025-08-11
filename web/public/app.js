// Fitlink Bot Marketing Site JavaScript
document.addEventListener('DOMContentLoaded', function() {
    console.log('Fitlink Bot marketing site loaded!');
    
    // Track CTA button clicks
    const ctaButtons = document.querySelectorAll('a[href*="t.me"]');
    ctaButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            console.log('Telegram CTA clicked - User converting to bot!');
            
            // Add analytics tracking here if needed
            // gtag('event', 'click', { 'event_category': 'CTA', 'event_label': 'Telegram Bot' });
            
            // Optional: Add a brief success message
            const originalText = this.innerHTML;
            this.innerHTML = '<i class="fab fa-telegram-plane mr-3 text-2xl"></i>Opening Telegram...';
            setTimeout(() => {
                this.innerHTML = originalText;
            }, 2000);
        });
    });
    
    // Simple scroll-triggered animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    // Animate chat bubbles on scroll
    const animateElements = document.querySelectorAll('.chat-bubble');
    animateElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'all 0.6s ease';
        observer.observe(el);
    });
    
    // Add mobile-friendly touch feedback
    const buttons = document.querySelectorAll('.cta-button');
    buttons.forEach(button => {
        button.addEventListener('touchstart', function() {
            this.style.transform = 'scale(0.95)';
        });
        
        button.addEventListener('touchend', function() {
            this.style.transform = 'scale(1)';
        });
    });
});
