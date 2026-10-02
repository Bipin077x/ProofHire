import { extractUrls, extractEmails } from '../src/lib/extract/regex';
console.log('URLs:', extractUrls('Careers.GOOGLE.com and careers@google.com.evil.in and hr.google@ybl'));
console.log('Emails:', extractEmails('Careers.GOOGLE.com and careers@google.com.evil.in and hr.google@ybl'));
