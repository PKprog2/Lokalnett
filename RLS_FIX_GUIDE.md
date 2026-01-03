# FIXING RLS ERROR: "new row violates row-level security policy"

## The Problem
When uploading a background image to a bygd, you're getting an RLS (Row Level Security) error even though you should have permission as a moderator or owner.

## Root Cause
Multiple conflicting RLS policies exist on the `bygder` table, and the old restrictive policy is taking precedence over the newer permissive one.

## The Solution

### Step 1: Run the SQL Fix Script
1. Open your Supabase dashboard
2. Go to **SQL Editor**
3. Open the file `FIX_BYGDER_RLS.sql` (in this project root)
4. Copy the ENTIRE contents
5. Paste into Supabase SQL Editor
6. Click **Run** or press Ctrl+Enter

### Step 2: Verify the Fix
After running the script, you should see a results table showing exactly 3 policies:
- `Anyone can view bygder` (SELECT)
- `Authenticated users can create bygder` (INSERT)
- `Owners and moderators can update bygder` (UPDATE)

### Step 3: Test Background Upload
1. Go to a bygd where you are owner or moderator
2. Click the background image upload button
3. Select an image
4. It should now upload successfully!

## What the Fix Does

The SQL script:
1. **Drops ALL existing policies** on the bygder table (including any conflicting ones)
2. **Creates 3 clean policies**:
   - SELECT: Anyone can view bygder
   - INSERT: Authenticated users can create new bygder
   - UPDATE: Creators, owners, and moderators can update bygder (including header_image_url)

The UPDATE policy specifically allows:
- The user who created the bygd (`created_by`)
- Anyone with a role of 'owner' or 'moderator' in the `bygd_roles` table

## Troubleshooting

### Still getting RLS error after running the script?
1. Check if the policies were actually created:
   - Go to Supabase Dashboard > Database > Tables
   - Click on `bygder` table
   - Click "Policies" tab
   - You should see exactly 3 policies listed

2. Check if you have the correct role:
   ```sql
   -- Run this query in Supabase SQL Editor
   -- Replace YOUR_USER_ID and BYGD_ID with actual values
   SELECT * FROM bygd_roles 
   WHERE user_id = 'YOUR_USER_ID' 
   AND bygd_id = 'BYGD_ID';
   ```
   You should see a row with role = 'moderator' or 'owner'

3. Check if the RPC function exists:
   ```sql
   -- Run this query to check if the function exists
   SELECT routine_name, routine_definition 
   FROM information_schema.routines 
   WHERE routine_name = 'set_bygd_header_image';
   ```

### Error: "function set_bygd_header_image does not exist"
Run this SQL to create the function:
```sql
CREATE OR REPLACE FUNCTION set_bygd_header_image(
  target_bygd_id UUID,
  header_url TEXT
) 
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE bygder
  SET header_image_url = header_url
  WHERE id = target_bygd_id
    AND (
      created_by = auth.uid() 
      OR EXISTS (
        SELECT 1 FROM bygd_roles
        WHERE bygd_roles.bygd_id = target_bygd_id
          AND bygd_roles.user_id = auth.uid()
          AND bygd_roles.role IN ('owner', 'moderator')
      )
    );
END;
$$;
```

## Technical Details

### Why RLS Policies Can Conflict
PostgreSQL RLS uses **AND** logic for policies on the same operation. If you have:
- Old policy: "Only creators can update" 
- New policy: "Creators OR moderators can update"

Both must be satisfied, so only creators can update (the most restrictive wins).

The fix removes ALL policies and creates fresh ones with the correct logic.

### The WITH CHECK vs USING Difference
- **USING**: Controls which existing rows can be selected/updated (WHO can see/modify)
- **WITH CHECK**: Controls what new/updated data is valid (WHAT can be written)

Both clauses need the same logic for UPDATE policies to work correctly.
