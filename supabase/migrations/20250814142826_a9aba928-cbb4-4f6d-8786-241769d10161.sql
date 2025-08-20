-- Create table for D&D sessions with user authentication
CREATE TABLE public.dnd_sessions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    custom_prompt TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.dnd_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own sessions" 
ON public.dnd_sessions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sessions" 
ON public.dnd_sessions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions" 
ON public.dnd_sessions 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions" 
ON public.dnd_sessions 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_dnd_sessions_updated_at
BEFORE UPDATE ON public.dnd_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create table for API usage tracking
CREATE TABLE public.api_usage (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    service TEXT NOT NULL, -- 'openai', 'runway', 'luma'
    operation TEXT NOT NULL, -- 'chat', 'image', 'video', 'tts'
    cost_estimate DECIMAL(10, 4) DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security for API usage
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

-- Create policies for API usage tracking
CREATE POLICY "Users can view their own API usage" 
ON public.api_usage 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "System can insert API usage" 
ON public.api_usage 
FOR INSERT 
WITH CHECK (true); -- Allow system to insert usage data