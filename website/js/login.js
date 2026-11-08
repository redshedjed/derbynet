
function handle_login(role, pwd) {
    $.ajax('action.php',
           {type: 'POST',
            data: {action: 'role.login',
                   name: role,
                   password: pwd},
            success: function(data) {
              if (data.hasOwnProperty('outcome') &&
                  data.outcome.hasOwnProperty('summary') &&
                  data.outcome.summary === 'success') {
			    window.location.href = (typeof g_after_login == 'undefined' || role == '')
                  ? 'index.php' : g_after_login;
              } else if (data.hasOwnProperty('outcome') &&
                         data.outcome.hasOwnProperty('summary') &&
                         data.outcome.summary === 'failure') {
				alert("Login fails: " + data.outcome.description);
		      } else {
				alert("Unrecognized XML: " + this.responseXML);
              }
            },
           });
}

function handle_logout() {
    handle_login("", "");
}

function handle_password_submission() {
    handle_login($("#name_for_password").val(), $("#pw_for_password").val());
}

function show_password_form(name) {
	document.getElementById("name_for_password").value = name;
    show_modal("#password_modal", function(event) {
        handle_password_submission();
        return false;
    });
	// Giving immediate focus doesn't work, because the element is still invisible.
	// Waiting 100ms is clumsy, but reasonably effective.
	setTimeout(function() { 
			document.getElementById('pw_for_password').focus(); }, 100);
}
