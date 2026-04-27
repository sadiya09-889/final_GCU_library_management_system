// Edge Function: sendOverdueNotifications.ts
// This function checks for overdue books and sends notifications/emails to students
// NOTE: You must configure your email provider (e.g., SendGrid) and set credentials in environment variables

import { createClient } from '@supabase/supabase-js';
// import sgMail from '@sendgrid/mail'; // Uncomment if using SendGrid

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
// sgMail.setApiKey(process.env.SENDGRID_API_KEY!); // Uncomment if using SendGrid

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function findNotificationRecipient(studentId: string, studentEmail?: string | null) {
  const normalizedStudentId = (studentId || '').trim();
  const normalizedStudentEmail = (studentEmail || '').trim().toLowerCase();

  if (normalizedStudentId) {
    const { data: regNoMatch, error } = await supabase
      .from('profiles')
      .select('id, email, reg_no')
      .eq('reg_no', normalizedStudentId)
      .maybeSingle();

    if (error) throw error;
    if (regNoMatch) return regNoMatch;
  }

  if (normalizedStudentId && looksLikeUuid(normalizedStudentId)) {
    const { data: idMatch, error } = await supabase
      .from('profiles')
      .select('id, email, reg_no')
      .eq('id', normalizedStudentId)
      .maybeSingle();

    if (error) throw error;
    if (idMatch) return idMatch;
  }

  if (normalizedStudentEmail) {
    const { data: emailMatch, error } = await supabase
      .from('profiles')
      .select('id, email, reg_no')
      .eq('email', normalizedStudentEmail)
      .maybeSingle();

    if (error) throw error;
    if (emailMatch) return emailMatch;
  }

  return null;
}

async function sendOverdueNotifications() {
  // 1. Find all overdue books (not returned, due_date < today)
  const { data: overdueBooks, error } = await supabase
    .from('issued_books')
    .select('id, book_id, book_title, due_date, student_id, student_email')
    .in('status', ['issued', 'overdue'])
    .lt('due_date', new Date().toISOString().slice(0, 10));

  if (error) throw error;
  if (!overdueBooks || overdueBooks.length === 0) return;

  for (const book of overdueBooks) {
    const recipient = await findNotificationRecipient(book.student_id, book.student_email);
    if (!recipient) continue;

    const matchedEmail = (book.student_email || recipient.email || '').trim().toLowerCase();

    // 2. Check if notification already sent
    let existingQuery = supabase
      .from('notifications')
      .select('id')
      .eq('recipient_id', recipient.id)
      .eq('type', 'overdue');

    if (book.book_id) {
      existingQuery = existingQuery.eq('related_book_id', book.book_id);
    } else {
      existingQuery = existingQuery.eq('message', `Your book "${book.book_title}" is overdue. Please return it as soon as possible.`);
    }

    const { data: existing, error: notifError } = await existingQuery;
    if (notifError) throw notifError;
    if (existing && existing.length > 0) continue; // Already notified

    // 3. Insert notification
    await supabase.from('notifications').insert({
      recipient_id: recipient.id,
      type: 'overdue',
      title: 'Book Overdue',
      message: `Your book "${book.book_title}" is overdue. Please return it as soon as possible.`,
      related_book_id: book.book_id || null,
      meta: {
        issued_book_id: book.id,
        student_reg_no: recipient.reg_no || book.student_id,
        student_email: matchedEmail || null,
        due_date: book.due_date,
      },
    });

    // 4. Send email (pseudo, replace with actual email logic)
    /*
    const msg = {
      to: matchedEmail,
      from: 'library@gardencityuniversity.edu',
      subject: 'Library Book Overdue Notice',
      text: `Your book "${book.book_title}" is overdue. Please return it as soon as possible.`,
    };
    await sgMail.send(msg);
    */
  }
}

sendOverdueNotifications().catch(console.error);
