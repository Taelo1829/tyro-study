-- Module descriptions are plain text, but the "Create module" form used to save
-- the lesson editor's HTML (e.g. "<p>&nbsp;</p>"). Turn those back into plain text.
UPDATE "modules"
SET "description" = NULLIF(
  btrim(
    regexp_replace(
      regexp_replace(
        replace(replace(replace(replace(replace(replace(
          regexp_replace(
            regexp_replace("description", '<\s*br\s*/?>|</\s*(p|div|li|h[1-6])\s*>', E'\n', 'gi'),
            '<[^>]*>', '', 'g'),
          '&nbsp;', ' '), '&amp;', '&'), '&lt;', '<'), '&gt;', '>'), '&quot;', '"'), '&#39;', ''''),
        '[ \t]+', ' ', 'g'),
      '\s*\n\s*', E'\n', 'g'),
    E' \n\t'),
  '')
WHERE "description" ~ '<[a-zA-Z/!]|&[a-zA-Z#0-9]+;';

-- Topics whose "content" is only an empty editor (e.g. "<p>&nbsp;</p>") have no lesson
UPDATE "topics"
SET "content" = NULL
WHERE "content" IS NOT NULL
  AND "content" !~* '<(img|iframe|video)'
  AND regexp_replace("content", '<[^>]*>|&nbsp;|\s', '', 'gi') = '';
