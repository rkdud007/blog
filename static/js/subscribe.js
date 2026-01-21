// Subscribe form handler.
document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('subscribe-form');
  const emailInput = document.getElementById('email');
  const messageDiv = document.getElementById('message');

  if (!form) return;

  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    const email = emailInput.value.trim();
    const submitButton = form.querySelector('button[type="submit"]');

    if (!email) {
      showMessage('Please enter your email address.', 'error');
      return;
    }

    // Disable form during submission.
    submitButton.disabled = true;
    submitButton.textContent = 'Subscribing...';
    messageDiv.textContent = '';

    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        showMessage(data.message || 'Successfully subscribed!', 'success');
        emailInput.value = '';
      } else {
        showMessage(data.error || 'Something went wrong. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Subscription error:', error);
      showMessage('Network error. Please try again later.', 'error');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Subscribe';
    }
  });

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.style.padding = '0.75rem';
    messageDiv.style.borderRadius = '4px';
    messageDiv.style.marginTop = '1rem';

    if (type === 'success') {
      messageDiv.style.backgroundColor = '#d4edda';
      messageDiv.style.color = '#155724';
      messageDiv.style.border = '1px solid #c3e6cb';
    } else {
      messageDiv.style.backgroundColor = '#f8d7da';
      messageDiv.style.color = '#721c24';
      messageDiv.style.border = '1px solid #f5c6cb';
    }
  }
});
