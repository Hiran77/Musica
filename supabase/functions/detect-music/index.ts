import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Process base64 in chunks to prevent memory issues
function processBase64Chunks(base64String: string, chunkSize = 32768) {
  const chunks: Uint8Array[] = [];
  let position = 0;
  
  while (position < base64String.length) {
    const chunk = base64String.slice(position, position + chunkSize);
    const binaryChunk = atob(chunk);
    const bytes = new Uint8Array(binaryChunk.length);
    
    for (let i = 0; i < binaryChunk.length; i++) {
      bytes[i] = binaryChunk.charCodeAt(i);
    }
    
    chunks.push(bytes);
    position += chunkSize;
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { audio } = await req.json();
    
    if (!audio) {
      throw new Error('No audio data provided');
    }

    console.log('Processing audio for music detection...');

    // Process audio in chunks
    const binaryAudio = processBase64Chunks(audio);
    
    // TODO: Integrate with ACRCloud API for music identification
    // For now, we'll prepare the audio and return a mock response
    // You'll need to add ACRCloud API key as a secret
    
    const acrcloudApiKey = Deno.env.get('ACRCLOUD_API_KEY');
    const acrcloudApiSecret = Deno.env.get('ACRCLOUD_API_SECRET');
    const acrcloudHost = Deno.env.get('ACRCLOUD_HOST');
    
    if (!acrcloudApiKey || !acrcloudApiSecret || !acrcloudHost) {
      console.warn('ACRCloud credentials not configured');
      return new Response(
        JSON.stringify({ 
          success: false,
          message: 'Music identification service not configured. Please add ACRCloud credentials.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare ACRCloud recognition request
    const timestamp = Math.floor(Date.now() / 1000);
    const stringToSign = `POST\n/v1/identify\n${acrcloudApiKey}\naudio\n1\n${timestamp}`;
    
    // Create HMAC-SHA1 signature
    const encoder = new TextEncoder();
    const keyData = encoder.encode(acrcloudApiSecret);
    const messageData = encoder.encode(stringToSign);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

    // Create multipart form data
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const formDataParts = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="sample"',
      'Content-Type: audio/wav',
      '',
      new TextDecoder().decode(binaryAudio),
      `--${boundary}`,
      'Content-Disposition: form-data; name="access_key"',
      '',
      acrcloudApiKey,
      `--${boundary}`,
      'Content-Disposition: form-data; name="data_type"',
      '',
      'audio',
      `--${boundary}`,
      'Content-Disposition: form-data; name="signature_version"',
      '',
      '1',
      `--${boundary}`,
      'Content-Disposition: form-data; name="signature"',
      '',
      signatureBase64,
      `--${boundary}`,
      'Content-Disposition: form-data; name="timestamp"',
      '',
      timestamp.toString(),
      `--${boundary}--`,
    ].join('\r\n');

    console.log('Calling ACRCloud API...');
    
    const acrResponse = await fetch(`https://${acrcloudHost}/v1/identify`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: formDataParts,
    });

    const acrData = await acrResponse.json();
    console.log('ACRCloud response:', JSON.stringify(acrData));

    if (acrData.status?.code === 0 && acrData.metadata?.music?.[0]) {
      const music = acrData.metadata.music[0];
      return new Response(
        JSON.stringify({ 
          success: true,
          song: {
            title: music.title,
            artist: music.artists?.[0]?.name || 'Unknown Artist',
            album: music.album?.name || 'Unknown Album',
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({ 
          success: false,
          message: 'No music detected in the audio sample',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: any) {
    console.error('Error in detect-music function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
