/* THE CONTACT FORM.

   This is a static site, so the message is relayed by Web3Forms
   (https://web3forms.com), which emails it on. The access key in the form is
   public by design; it only names the inbox.

   What has to be true before anything is sent:
   - a name, a message of at least ten characters, and an email address that
     looks like one (something@domain.tld, no spaces), checked here and again
     by the browser's own email type;
   - the hidden honeypot box is empty (people never see it, form-filling bots
     tick it);
   - the hCaptcha is solved. Web3Forms checks the token on its own server when
     hCaptcha is switched on in its dashboard, so a bot cannot skip it by
     calling the API directly.

   Without an access key yet, sending opens the visitor's own email app with
   the message already written, so the form is never a dead end. */
(function () {
  "use strict";

  var form = document.getElementById("contact-form");
  if (!form || !window.fetch) return;

  var status = document.getElementById("cf-status");
  var button = form.querySelector("button[type='submit']");
  var keyInput = form.querySelector("input[name='access_key']");
  var key = keyInput ? keyInput.value.trim() : "";
  var EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[A-Za-z]{2,}$/;

  // The captcha widget only comes in when there is somewhere to send to.
  var captcha = form.querySelector(".h-captcha");
  if (key) {
    var s = document.createElement("script");
    s.src = "https://web3forms.com/client/script.js";
    s.async = true; s.defer = true;
    document.body.appendChild(s);
  } else if (captcha) {
    captcha.hidden = true;
  }

  function say(text, kind) {
    status.textContent = text;
    status.className = "form-status" + (kind ? " is-" + kind : "");
  }

  function field(name) { return form.elements[name]; }

  function invalid(el, text) {
    el.setAttribute("aria-invalid", "true");
    el.focus();
    say(text, "error");
    return false;
  }

  function check() {
    ["name", "email", "message"].forEach(function (n) { field(n).removeAttribute("aria-invalid"); });
    var name = field("name").value.trim();
    var email = field("email").value.trim();
    var message = field("message").value.trim();
    if (!name) return invalid(field("name"), "Please tell me your name.");
    if (!EMAIL.test(email) || !field("email").checkValidity()) return invalid(field("email"), "Please enter a valid email address, so I can write back.");
    if (message.length < 10) return invalid(field("message"), "Please write a little more in your message.");
    return true;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!check()) return;

    var honey = field("botcheck");
    if (honey && honey.checked) return;   // a bot: say nothing, send nothing

    if (!key) {
      var to = form.getAttribute("data-fallback");
      var subject = "Message from " + field("name").value.trim() + " via your website";
      var body = field("message").value.trim() + "\n\n" + field("name").value.trim() + "\n" + field("email").value.trim();
      window.location.href = "mailto:" + to + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
      say("Your email app should open with the message ready to send.", "ok");
      return;
    }

    var token = form.querySelector("[name='h-captcha-response']");
    if (!token || !token.value) { say("Please complete the CAPTCHA first.", "error"); return; }

    var data = Object.fromEntries(new FormData(form));
    data.email = data.email.trim();
    data.replyto = data.email;
    button.disabled = true;
    say("Sending...", "");

    fetch(form.action, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(data)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (json) {
        if (res.ok && json.success !== false) {
          form.reset();
          say("Thank you, your message is on its way. I will reply by email.", "ok");
        } else if (res.status === 429) {
          say("Too many messages from this connection. Please try again in an hour.", "error");
        } else {
          var msg = json.message || (json.body && json.body.message);
          say((msg ? msg + ". " : "") + "It did not send; you can also email me at tsingh65@asu.edu.", "error");
        }
      });
    }).catch(function () {
      say("It did not send. Please check your connection, or email me at tsingh65@asu.edu.", "error");
    }).then(function () {
      if (window.hcaptcha && typeof window.hcaptcha.reset === "function") {
        try { window.hcaptcha.reset(); } catch (err) { /* widget not rendered */ }
      }
      // A pause before the next send, so one person cannot hammer the button.
      window.setTimeout(function () { button.disabled = false; }, 8000);
    });
  });
})();
