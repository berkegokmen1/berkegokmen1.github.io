import cv2
from moviepy.editor import VideoFileClip

def split_video_into_nine_segments(video_path, output_prefix):
    # Load the video
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print("Error: Could not open video.")
        return
    
    # Get video properties
    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = frame_count / fps
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    # Check that the video is at least 4 seconds long
    if duration < 4:
        print("Error: Video must be at least 4 seconds long.")
        return
    
    # Calculate the segment width and height for a 3x3 grid
    segment_width = width // 3
    segment_height = height // 3
    
    # Define the start and end times (4 seconds)
    start_time = 0
    end_time = 4  # duration in seconds for each segment
    
    # Read the video and create clips for each of the 9 segments
    clip = VideoFileClip(video_path).subclip(start_time, end_time)
    
    # Define the coordinates for each 3x3 grid segment
    segments = {
        "top_left": (0, 0, segment_width, segment_height),
        "top_center": (segment_width, 0, 2 * segment_width, segment_height),
        "top_right": (2 * segment_width, 0, width, segment_height),
        "middle_left": (0, segment_height, segment_width, 2 * segment_height),
        "middle_center": (segment_width, segment_height, 2 * segment_width, 2 * segment_height),
        "middle_right": (2 * segment_width, segment_height, width, 2 * segment_height),
        "bottom_left": (0, 2 * segment_height, segment_width, height),
        "bottom_center": (segment_width, 2 * segment_height, 2 * segment_width, height),
        "bottom_right": (2 * segment_width, 2 * segment_height, width, height),
    }
    
    # Process and save each segment
    for segment_name, (x1, y1, x2, y2) in segments.items():
        cropped_clip = clip.crop(x1=x1, y1=y1, x2=x2, y2=y2)
        cropped_clip.write_videofile(f"{output_prefix}_{segment_name}.mp4", fps=fps)

    # Release resources
    cap.release()
    print("9-segment videos have been saved.")

# Example usage:
split_video_into_nine_segments("output_video_down_left.mp4", "output_video_9")
