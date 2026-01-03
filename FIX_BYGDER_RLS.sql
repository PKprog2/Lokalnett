-- ========================================
-- FIX BYGDER RLS POLICIES FOR BACKGROUND UPLOAD
-- ========================================
-- Run this entire script in Supabase SQL Editor to fix the RLS issue
-- This will remove ALL existing bygder policies and create clean new ones

-- Step 1: Drop ALL existing policies on bygder table
DROP POLICY IF EXISTS "Users can create bygder" ON bygder;
DROP POLICY IF EXISTS "Creators can update their bygder" ON bygder;
DROP POLICY IF EXISTS "Owners can update their bygder" ON bygder;
DROP POLICY IF EXISTS "Owners and moderators can update bygder" ON bygder;
DROP POLICY IF EXISTS "Members can view bygder" ON bygder;
DROP POLICY IF EXISTS "Anyone can view bygder" ON bygder;
DROP POLICY IF EXISTS "Public bygder are viewable" ON bygder;

-- Step 2: Create fresh SELECT policy (for viewing bygder)
CREATE POLICY "Anyone can view bygder"
  ON bygder FOR SELECT
  USING (true);

-- Step 3: Create fresh INSERT policy (for creating new bygder)
CREATE POLICY "Authenticated users can create bygder"
  ON bygder FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Step 4: Create comprehensive UPDATE policy (for background images, etc.)
CREATE POLICY "Owners and moderators can update bygder"
  ON bygder FOR UPDATE
  USING (
    -- Creator can always update
    auth.uid() = created_by 
    OR
    -- Moderators and owners can update
    EXISTS (
      SELECT 1 FROM bygd_roles
      WHERE bygd_roles.bygd_id = bygder.id
        AND bygd_roles.user_id = auth.uid()
        AND bygd_roles.role IN ('owner', 'moderator')
    )
  )
  WITH CHECK (
    -- Creator can always update
    auth.uid() = created_by 
    OR
    -- Moderators and owners can update
    EXISTS (
      SELECT 1 FROM bygd_roles
      WHERE bygd_roles.bygd_id = bygder.id
        AND bygd_roles.user_id = auth.uid()
        AND bygd_roles.role IN ('owner', 'moderator')
    )
  );

-- Step 5: Verify policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'bygder'
ORDER BY policyname;

-- You should see 3 policies:
-- 1. "Anyone can view bygder" (SELECT)
-- 2. "Authenticated users can create bygder" (INSERT)
-- 3. "Owners and moderators can update bygder" (UPDATE)
