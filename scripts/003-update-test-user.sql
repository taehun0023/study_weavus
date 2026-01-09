-- Update test user with proper password hash (password: test123)
UPDATE users 
SET password_hash = '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92'
WHERE username = 'testuser';

-- If user doesn't exist, insert it
INSERT INTO users (username, password_hash, display_name)
SELECT 'testuser', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', '테스트 유저'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'testuser');
