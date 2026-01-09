-- Fix password hash for testuser
-- Password: test123
-- SHA-256 hash of "test123" = ecd71870d1963316a97e3ac3408c9835ad8cf0f3c1bc703527c30265534f75ae

UPDATE users 
SET password_hash = 'ecd71870d1963316a97e3ac3408c9835ad8cf0f3c1bc703527c30265534f75ae'
WHERE username = 'testuser';
