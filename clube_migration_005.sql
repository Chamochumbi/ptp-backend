-- Support the public access request workflow on existing databases.
ALTER TABLE ptp_applications DROP CONSTRAINT IF EXISTS ptp_applications_application_type_check;
ALTER TABLE ptp_applications ADD CONSTRAINT ptp_applications_application_type_check CHECK (application_type IN ('company','provider','access'));
