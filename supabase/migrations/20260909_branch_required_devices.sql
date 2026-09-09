ALTER TABLE screening_branches ADD COLUMN required_device_ids UUID[] DEFAULT '{}';
UPDATE screening_branches SET required_device_ids = ARRAY['01bcadab-ded4-4831-81f5-e410beb2ed85']::uuid[] WHERE requires_echo_bed = true;
ALTER TABLE screening_branches DROP COLUMN requires_echo_bed;
