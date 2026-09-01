-- Connection Accepted Email. The friend-request email (issue #228) tells the
-- addressee a request is waiting; this is the other half — the requester gets
-- an email the moment it's accepted, so the person who reached out learns the
-- Connection is live without having to keep checking the Friends page.
--
-- One column, same shape as the three toggles already on this table: its own
-- opt-out, independent of the friend-request email's, and on by default.
alter table public.notification_preferences
  add column connection_accepted_email_enabled boolean not null default true;

comment on column public.notification_preferences.connection_accepted_email_enabled is
  'Opt-in for the email the requester gets when their friend request is accepted — independent of connection_request_email_enabled and the two Reminder toggles.';
