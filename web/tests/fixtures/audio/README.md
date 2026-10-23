# Test recordings

Synthetic 300 Hz tones, no voices. Made with ffmpeg:

```bash
ffmpeg -f lavfi -i "sine=frequency=300:duration=6.5" -ac 1 -c:a libopus -b:a 16k tone-6500ms.webm
ffmpeg -f lavfi -i "sine=frequency=300:duration=6.5" -ac 1 -c:a libopus -b:a 16k -live 1 -cluster_time_limit 1000 tone-6500ms-live.webm
ffmpeg -f lavfi -i "sine=frequency=300:duration=6.5" -ac 1 -c:a aac -b:a 24k tone-6500ms.m4a
ffmpeg -f lavfi -i "sine=frequency=300:duration=6.5" -ac 1 -c:a aac -b:a 24k -movflags frag_keyframe+empty_moov+default_base_moof -frag_duration 1000000 -f mp4 tone-6500ms-frag.mp4
ffmpeg -f lavfi -i "sine=frequency=300:duration=2" -ac 1 -c:a libopus -b:a 16k tone-2000ms.webm
```

The `-live` WebM has no length in its header, like Chrome's recordings. The fragmented MP4 is like Safari's.
