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

CREATE POLICY "Users can create bygder" 
  ON bygder FOR INSERT 
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators can update their bygder" 
  ON bygder FOR UPDATE 
  USING (auth.uid() = created_by);
```
-- TIL HER

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
  parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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
