-- Insert default course: Java
INSERT INTO courses (name, slug, description, icon) VALUES
('Java', 'java', 'Java 프로그래밍 학습 코스', 'coffee')
ON CONFLICT (slug) DO NOTHING;

-- Insert test user (password: test123 - SHA-256 hash)
INSERT INTO users (username, password_hash, display_name) VALUES
('testuser', 'ecd71870d1963316a97e3ac3408c9835ad8cf0f3c1bc703527c30265534f75ae', '테스트 유저')
ON CONFLICT (username) DO NOTHING;

-- Insert sample posts for Java course
INSERT INTO posts (course_id, title, type, difficulty, content) VALUES
((SELECT id FROM courses WHERE slug = 'java'), 'Java 기초 문법', 'lesson', 'easy', '# Java 기초 문법\n\nJava의 기본 문법을 배워봅시다.'),
((SELECT id FROM courses WHERE slug = 'java'), '변수와 자료형', 'lesson', 'easy', '# 변수와 자료형\n\nJava의 변수와 자료형에 대해 알아봅니다.'),
((SELECT id FROM courses WHERE slug = 'java'), '조건문과 반복문', 'lesson', 'medium', '# 조건문과 반복문\n\nif, switch, for, while 등을 학습합니다.'),
((SELECT id FROM courses WHERE slug = 'java'), 'Java 기초 퀴즈', 'quiz', 'easy', NULL),
((SELECT id FROM courses WHERE slug = 'java'), '변수와 자료형 퀴즈', 'quiz', 'medium', NULL),
((SELECT id FROM courses WHERE slug = 'java'), '조건문 퀴즈', 'quiz', 'hard', NULL),
((SELECT id FROM courses WHERE slug = 'java'), 'Java 공식 문서', 'reference', NULL, 'https://docs.oracle.com/javase/tutorial/'),
((SELECT id FROM courses WHERE slug = 'java'), 'Java 코딩 컨벤션', 'reference', NULL, 'https://google.github.io/styleguide/javaguide.html');

-- Insert quiz questions for "Java 기초 퀴즈"
INSERT INTO quiz_questions (post_id, question_text, question_type, options, correct_answer, explanation, order_index)
SELECT p.id, q.question_text, q.question_type, q.options::jsonb, q.correct_answer, q.explanation, q.order_index
FROM posts p
CROSS JOIN (VALUES
  ('Java에서 main 메서드의 올바른 선언은?', 'multiple_choice', '["public static void main(String[] args)", "public void main(String args)", "static public main(String[] args)", "void main()"]', 'public static void main(String[] args)', 'Java 프로그램의 시작점인 main 메서드는 public static void main(String[] args) 형태로 선언해야 합니다.', 1),
  ('Java는 어떤 유형의 프로그래밍 언어인가요?', 'multiple_choice', '["객체지향 언어", "절차지향 언어", "함수형 언어", "스크립트 언어"]', '객체지향 언어', 'Java는 대표적인 객체지향 프로그래밍 언어입니다.', 2),
  ('Java 파일의 확장자는?', 'short_answer', NULL, '.java', 'Java 소스 코드 파일의 확장자는 .java입니다.', 3),
  ('System.out.println()의 역할은?', 'multiple_choice', '["콘솔에 출력", "파일에 저장", "네트워크 전송", "메모리 할당"]', '콘솔에 출력', 'System.out.println()은 콘솔에 텍스트를 출력하고 줄바꿈을 수행합니다.', 4),
  ('Java에서 한 줄 주석을 작성할 때 사용하는 기호는?', 'short_answer', NULL, '//', '한 줄 주석은 //로 시작합니다.', 5)
) AS q(question_text, question_type, options, correct_answer, explanation, order_index)
WHERE p.title = 'Java 기초 퀴즈';

-- Insert quiz questions for "변수와 자료형 퀴즈"
INSERT INTO quiz_questions (post_id, question_text, question_type, options, correct_answer, explanation, order_index)
SELECT p.id, q.question_text, q.question_type, q.options::jsonb, q.correct_answer, q.explanation, q.order_index
FROM posts p
CROSS JOIN (VALUES
  ('int 자료형의 크기는?', 'multiple_choice', '["4바이트", "2바이트", "8바이트", "1바이트"]', '4바이트', 'int는 32비트(4바이트) 정수형입니다.', 1),
  ('문자열을 저장하는 자료형은?', 'multiple_choice', '["String", "char", "int", "boolean"]', 'String', 'String은 문자열을 저장하는 참조 자료형입니다.', 2),
  ('boolean 자료형이 가질 수 있는 값은?', 'multiple_choice', '["true, false", "0, 1", "yes, no", "T, F"]', 'true, false', 'boolean은 true 또는 false 값만 가질 수 있습니다.', 3),
  ('double과 float 중 더 높은 정밀도를 가진 것은?', 'short_answer', NULL, 'double', 'double은 64비트로 float(32비트)보다 높은 정밀도를 가집니다.', 4),
  ('final 키워드로 선언된 변수의 특징은?', 'multiple_choice', '["값을 변경할 수 없다", "값이 0이다", "정수만 저장된다", "null이다"]', '값을 변경할 수 없다', 'final로 선언된 변수는 상수가 되어 값을 변경할 수 없습니다.', 5)
) AS q(question_text, question_type, options, correct_answer, explanation, order_index)
WHERE p.title = '변수와 자료형 퀴즈';

-- Insert quiz questions for "조건문 퀴즈"
INSERT INTO quiz_questions (post_id, question_text, question_type, options, correct_answer, explanation, order_index)
SELECT p.id, q.question_text, q.question_type, q.options::jsonb, q.correct_answer, q.explanation, q.order_index
FROM posts p
CROSS JOIN (VALUES
  ('if-else 문에서 조건이 거짓일 때 실행되는 블록은?', 'multiple_choice', '["else 블록", "if 블록", "둘 다", "아무것도 실행 안됨"]', 'else 블록', '조건이 false이면 else 블록이 실행됩니다.', 1),
  ('switch 문에서 각 case 끝에 사용하는 키워드는?', 'short_answer', NULL, 'break', 'break를 사용하지 않으면 다음 case로 fall-through됩니다.', 2),
  ('for(int i=0; i<5; i++)에서 반복 횟수는?', 'multiple_choice', '["5회", "4회", "6회", "무한"]', '5회', 'i가 0부터 4까지 총 5번 반복됩니다.', 3),
  ('while 문과 do-while 문의 차이점은?', 'multiple_choice', '["do-while은 최소 1번 실행", "while이 더 빠르다", "차이 없음", "do-while은 조건 없음"]', 'do-while은 최소 1번 실행', 'do-while은 조건을 나중에 검사하므로 최소 1번은 실행됩니다.', 4),
  ('삼항 연산자의 형식은?', 'multiple_choice', '["조건 ? 참 : 거짓", "조건 : 참 ? 거짓", "if 조건 then else", "조건 && 참 || 거짓"]', '조건 ? 참 : 거짓', '삼항 연산자는 조건 ? 참일때값 : 거짓일때값 형식입니다.', 5)
) AS q(question_text, question_type, options, correct_answer, explanation, order_index)
WHERE p.title = '조건문 퀴즈';
