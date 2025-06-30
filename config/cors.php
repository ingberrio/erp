<?php
return [
    'paths' => ['api/*', 'sanctum/csrf-cookie', 'login', 'logout', 'register', 'user'], // Asegúrate de que 'user' también esté
    'allowed_methods' => ['*'],
    'allowed_origins' => ['http://localhost:5173'], // ¡CRÍTICO!
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => true, // ¡CRÍTICO!
];