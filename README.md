# TranscodingOwl

Autotranscoder for TV Shows using FFMPEG with HW-Accel.  
All encoders use constant quality. Supported are nvidia, amd and cpu. It will only show you avaible hardware!  

You´ll need to place ffmpeg binary into ./bin/ffmpeg

## Features
- Recursive scanning of your media library
- Simple CLI based user interface
- Tracks already encoded files, so you don´t have to
- Parallel file processing (One per encoder found)
- Shows progress for each file in seconds
- Logs all actions
- Shows starting and final size at the end

## Use multiple GPUs

It can´t dedect multiple GPUs, so you´ll need to set it manually in the config.json  
Just add the GPUs you want to use to the array.

```json
"hevc_nvenc": {
        "cname": "hevc_nvenc",
        "name": "hevc_nvenc",
        "type": "GPU",
        "special_params": "-hwaccel 0",
        "quality": "vbr",
        "quality_command": "-rc:v vbr",
        "quality_constract": ["-cq"],
        "quality_preset_command": "-preset",
        "quality_preset_constract": ["fast", "medium", "slow"]
    },
"hevc_nvenc": {
        "cname": "hevc_nvenc_2",
        "name": "hevc_nvenc",
        "type": "GPU",
        "special_params": "-hwaccel 0",
        "quality": "vbr",
        "quality_command": "-rc:v vbr",
        "quality_constract": ["-cq"],
        "quality_preset_command": "-preset",
        "quality_preset_constract": ["fast", "medium", "slow"]
    },
```
