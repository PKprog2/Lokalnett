# LokalNett Database Schema

This document describes the database schema for LokalNett. These tables should be created in your Supabase project.

## Tables

### profiles
Extends the auth.users table with additional user information.

```sql
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public profiles are viewable by everyone" 
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" 
  ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" 
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
```

### bygder
Represents the local communities (bygder).

```sql
CREATE TABLE bygder (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  member_count INTEGER DEFAULT 0,
  max_members INTEGER DEFAULT 1000,
  header_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE bygder ENABLE ROW LEVEL SECURITY;

-- Policies DENNE MÅ LEGGES TIL FRA HER
CREATE POLICY "Bygder are viewable by members" 
  ON bygder FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM bygd_members 
      WHERE bygd_members.bygd_id = bygder.id 
      AND bygd_members.user_id = auth.uid()
    )
  );

-- IMPORTANT: Run FIX_BYGDER_RLS.sql to properly set up these policies
-- The SQL script will drop ALL existing policies and create clean ones

CREATE POLICY "Anyone can view bygder"
  ON bygder FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create bygder"
  ON bygder FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owners and moderators can update bygder"
  ON bygder FOR UPDATE
  USING (
    auth.uid() = created_by 
    OR
    EXISTS (
      SELECT 1 FROM bygd_roles
      WHERE bygd_roles.bygd_id = bygder.id
        AND bygd_roles.user_id = auth.uid()
        AND bygd_roles.role IN ('owner', 'moderator')
    )
  )
  WITH CHECK (
    auth.uid() = created_by 
    OR
    EXISTS (
      SELECT 1 FROM bygd_roles
      WHERE bygd_roles.bygd_id = bygder.id
        AND bygd_roles.user_id = auth.uid()
        AND bygd_roles.role IN ('owner', 'moderator')
    )
  );
```

### bygd_members
Join table for users and bygder (many-to-many relationship).

```sql
CREATE TABLE bygd_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bygd_id UUID REFERENCES bygder(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bygd_id, user_id)
);

-- Enable RLS
ALTER TABLE bygd_members ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Members can view bygd memberships" 
  ON bygd_members FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM bygd_members bm 
      WHERE bm.bygd_id = bygd_members.bygd_id 
      AND bm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can join bygder" 
  ON bygd_members FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave bygder" 
  ON bygd_members FOR DELETE 
  USING (auth.uid() = user_id);
```

### bygd_roles
Stores elevated permissions (owner/moderator) per bygd. Owners are already tracked via `bygder.created_by`, but a matching row in this table makes it easy to expose in the UI and to promote additional moderators.

```sql
CREATE TABLE bygd_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bygd_id UUID REFERENCES bygder(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'moderator')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bygd_id, user_id)
);

ALTER TABLE bygd_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view bygd roles"
  ON bygd_roles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bygd_members
      WHERE bygd_members.bygd_id = bygd_roles.bygd_id
      AND bygd_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can assign roles"
  ON bygd_roles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bygder
      WHERE bygder.id = bygd_roles.bygd_id
      AND bygder.created_by = auth.uid()
    )
  );

CREATE POLICY "Owners can update roles"
  ON bygd_roles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM bygder
      WHERE bygder.id = bygd_roles.bygd_id
      AND bygder.created_by = auth.uid()
    )
  );

CREATE POLICY "Owners can revoke roles"
  ON bygd_roles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM bygder
      WHERE bygder.id = bygd_roles.bygd_id
      AND bygder.created_by = auth.uid()
    )
  );
```

### posts
Posts within bygder.

```sql
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bygd_id UUID REFERENCES bygder(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('image', 'video')),
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Members can view bygd posts" 
  ON posts FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM bygd_members 
      WHERE bygd_members.bygd_id = posts.bygd_id 
      AND bygd_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can create posts" 
  ON posts FOR INSERT 
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM bygd_members 
      WHERE bygd_members.bygd_id = posts.bygd_id 
      AND bygd_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own posts" 
  ON posts FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts" 
  ON posts FOR DELETE 
  USING (auth.uid() = user_id);
```

### likes
Likes on posts.

```sql
CREATE TABLE likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- Enable RLS
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Members can view likes" 
  ON likes FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM posts 
      JOIN bygd_members ON posts.bygd_id = bygd_members.bygd_id
      WHERE posts.id = likes.post_id 
      AND bygd_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create likes" 
  ON likes FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own likes" 
  ON likes FOR DELETE 
  USING (auth.uid() = user_id);
```

### comments
Comments on posts.

```sql
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  gif_url TEXT,
  parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Existing prosjekter kan legge til kolonnen slik:
-- ALTER TABLE comments ADD COLUMN IF NOT EXISTS gif_url TEXT;

-- Enable RLS
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Members can view comments" 
  ON comments FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM posts 
      JOIN bygd_members ON posts.bygd_id = bygd_members.bygd_id
      WHERE posts.id = comments.post_id 
      AND bygd_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can create comments" 
  ON comments FOR INSERT 
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM posts 
      JOIN bygd_members ON posts.bygd_id = bygd_members.bygd_id
      WHERE posts.id = comments.post_id 
      AND bygd_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own comments" 
  ON comments FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments" 
  ON comments FOR DELETE 
  USING (auth.uid() = user_id);
```

### comment_likes
Stores per-user likes on individual comments so they stay in sync across devices.

```sql
CREATE TABLE comment_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(comment_id, user_id)
);

-- Enable RLS
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Members can view comment likes" 
  ON comment_likes FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM comments 
      JOIN posts ON comments.post_id = posts.id
      JOIN bygd_members ON posts.bygd_id = bygd_members.bygd_id
      WHERE comments.id = comment_likes.comment_id 
      AND bygd_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can like comments" 
  ON comment_likes FOR INSERT 
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM comments 
      JOIN posts ON comments.post_id = posts.id
      JOIN bygd_members ON posts.bygd_id = bygd_members.bygd_id
      WHERE comments.id = comment_likes.comment_id 
      AND bygd_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can remove own comment likes" 
  ON comment_likes FOR DELETE 
  USING (auth.uid() = user_id);
```

### direct_conversations
Pairs two distinct users before messages are inserted. `participant_a` and `participant_b` are stored in lexicographical order to guarantee uniqueness.

```sql
CREATE TABLE direct_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_a UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  participant_b UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT participant_order CHECK (participant_a < participant_b),
  UNIQUE(participant_a, participant_b)
);

ALTER TABLE direct_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view conversations"
  ON direct_conversations FOR SELECT
  USING (participant_a = auth.uid() OR participant_b = auth.uid());

CREATE POLICY "Participants can insert conversations"
  ON direct_conversations FOR INSERT
  WITH CHECK (
    (participant_a = auth.uid() OR participant_b = auth.uid())
    AND participant_a <> participant_b
  );

CREATE POLICY "Participants can update own conversations"
  ON direct_conversations FOR UPDATE
  USING (participant_a = auth.uid() OR participant_b = auth.uid());
```

### direct_messages
Stores all 1:1 chat messages. `read_at` is nullable and set when the recipient opens the thread.

```sql
CREATE TABLE direct_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES direct_conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX direct_messages_conversation_idx
  ON direct_messages (conversation_id, created_at);

ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can read direct messages"
  ON direct_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM direct_conversations
      WHERE direct_conversations.id = direct_messages.conversation_id
        AND (
          direct_conversations.participant_a = auth.uid()
          OR direct_conversations.participant_b = auth.uid()
        )
    )
  );

CREATE POLICY "Participants can send direct messages"
  ON direct_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM direct_conversations
      WHERE direct_conversations.id = direct_messages.conversation_id
        AND (
          direct_conversations.participant_a = auth.uid()
          OR direct_conversations.participant_b = auth.uid()
        )
    )
  );

CREATE POLICY "Recipients can mark messages as read"
  ON direct_messages FOR UPDATE
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());
```

## Functions

### Update member count trigger
Automatically updates the member_count in bygder table.

```sql
CREATE OR REPLACE FUNCTION update_bygd_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE bygder SET member_count = member_count + 1 WHERE id = NEW.bygd_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE bygder SET member_count = member_count - 1 WHERE id = OLD.bygd_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bygd_member_count_trigger
AFTER INSERT OR DELETE ON bygd_members
FOR EACH ROW EXECUTE FUNCTION update_bygd_member_count();
```

### Update post likes count trigger

```sql
CREATE OR REPLACE FUNCTION update_post_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET likes_count = likes_count - 1 WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER post_likes_count_trigger
AFTER INSERT OR DELETE ON likes
FOR EACH ROW EXECUTE FUNCTION update_post_likes_count();
```

### Update post comments count trigger

```sql
CREATE OR REPLACE FUNCTION update_post_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET comments_count = comments_count - 1 WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER post_comments_count_trigger
AFTER INSERT OR DELETE ON comments
FOR EACH ROW EXECUTE FUNCTION update_post_comments_count();
```

### moderator_delete_comment helper
Allows bygdeiere og moderatorer å slette kommentarer via en trygg RPC som omgår RLS etter at tilgang er validert.

```sql
CREATE OR REPLACE FUNCTION moderator_delete_comment(
  target_comment_id UUID,
  actor_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  comment_row comments%ROWTYPE;
  post_row posts%ROWTYPE;
  actor_can_delete BOOLEAN;
BEGIN
  SELECT * INTO comment_row FROM comments WHERE id = target_comment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comment % not found', target_comment_id;
  END IF;

  SELECT * INTO post_row FROM posts WHERE id = comment_row.post_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parent post missing for comment %', target_comment_id;
  END IF;

  IF actor_id = comment_row.user_id THEN
    DELETE FROM comments WHERE id = target_comment_id;
    RETURN;
  END IF;

  actor_can_delete :=
    post_row.user_id = actor_id
    OR EXISTS (
      SELECT 1
      FROM bygder
      WHERE bygder.id = post_row.bygd_id
        AND bygder.created_by = actor_id
    )
    OR EXISTS (
      SELECT 1
      FROM bygd_roles
      WHERE bygd_roles.bygd_id = post_row.bygd_id
        AND bygd_roles.user_id = actor_id
        AND bygd_roles.role IN ('owner', 'moderator')
    );

  IF NOT actor_can_delete THEN
    RAISE EXCEPTION 'Actor % is not allowed to delete comment %', actor_id, target_comment_id;
  END IF;

  DELETE FROM comments WHERE id = target_comment_id;
END;
$$;

REVOKE ALL ON FUNCTION moderator_delete_comment(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION moderator_delete_comment(UUID, UUID) TO authenticated;
```

### set_bygd_header_image helper
Allows bygdeiere og moderatorer å oppdatere toppbakgrunnsbilde gjennom en sikker RPC i stedet for direkte RLS.

```sql
CREATE OR REPLACE FUNCTION set_bygd_header_image(
  target_bygd_id UUID,
  header_url TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id UUID := auth.uid();
  can_edit BOOLEAN;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Mangler innlogget bruker.';
  END IF;

  SELECT
    (b.created_by = actor_id)
    OR EXISTS (
      SELECT 1 FROM bygd_roles
      WHERE bygd_roles.bygd_id = target_bygd_id
        AND bygd_roles.user_id = actor_id
        AND bygd_roles.role IN ('owner', 'moderator')
    )
  INTO can_edit
  FROM bygder b
  WHERE b.id = target_bygd_id;

  IF NOT can_edit THEN
    RAISE EXCEPTION 'Du har ikke rettigheter til å endre denne bygda.';
  END IF;

  UPDATE bygder
  SET header_image_url = header_url,
      updated_at = NOW()
  WHERE id = target_bygd_id;
END;
$$;

REVOKE ALL ON FUNCTION set_bygd_header_image(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_bygd_header_image(UUID, TEXT) TO authenticated;
```

### delete_user_account helper
Allows an authenticated user to wipe their own data (memberships, innhold og konto) via the `delete_user_account` RPC used by the frontend settings-dialog.

```sql
CREATE OR REPLACE FUNCTION delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  target uuid := auth.uid();
BEGIN
  IF target IS NULL THEN
    RAISE EXCEPTION 'Ingen aktiv bruker i sesjonen.';
  END IF;

  DELETE FROM bygd_roles WHERE user_id = target;
  DELETE FROM bygd_members WHERE user_id = target;
  DELETE FROM likes WHERE user_id = target;
  DELETE FROM comment_likes WHERE user_id = target;
  DELETE FROM comments WHERE user_id = target;
  DELETE FROM posts WHERE user_id = target;
  DELETE FROM profiles WHERE id = target;

  PERFORM auth.delete_user(target);
END;
$$;

REVOKE EXECUTE ON FUNCTION delete_user_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_user_account() TO authenticated;
```

## Storage Buckets

### media
For storing post images and videos.

```sql
-- Create bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('media', 'media', true);

-- Policies
CREATE POLICY "Media is publicly accessible" 
  ON storage.objects FOR SELECT 
  USING (bucket_id = 'media');

CREATE POLICY "Users can upload media" 
  ON storage.objects FOR INSERT 
  WITH CHECK (
    bucket_id = 'media' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own media" 
  ON storage.objects FOR DELETE 
  USING (
    bucket_id = 'media' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
```

### avatars
For storing user profile pictures.

```sql
-- Create bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Policies
CREATE POLICY "Avatars are publicly accessible" 
  ON storage.objects FOR SELECT 
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload own avatar" 
  ON storage.objects FOR INSERT 
  WITH CHECK (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update own avatar" 
  ON storage.objects FOR UPDATE 
  USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own avatar" 
  ON storage.objects FOR DELETE 
  USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
```

## Setup Instructions

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the SQL statements above in order
4. Execute each section to create the tables, policies, triggers, and storage buckets
5. Verify that Row Level Security (RLS) is enabled on all tables
